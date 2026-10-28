/**
 * Choosing a target photo (#63): no permission, no location kept.
 *
 * expo-image-picker and expo-file-system are native modules, so both are
 * replaced here -- the picker by a stand-in that returns what the real one
 * returns (`{ canceled, assets: [{ uri, width, height }] }`), the file system by
 * an in-memory one with the same `File`/`Directory` surface. What is asserted is
 * what this module asks the picker for and what it writes, which is where the
 * privacy properties live.
 */

import { deleteTargetPhoto, pickTargetPhoto } from '../../../src/services/TargetPhotoService';
import { UnsupportedImageError } from '../../../src/utils/imageMetadata';

const files = new Map<string, Uint8Array>();
const directories = new Set<string>();

jest.mock('expo-file-system', () => {
  const join = (parts: unknown[]) =>
    parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
  class File {
    readonly uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return files.has(this.uri);
    }
    async bytes() {
      const b = files.get(this.uri);
      if (!b) throw new Error(`No such file: ${this.uri}`);
      return b;
    }
    create() {
      files.set(this.uri, new Uint8Array());
    }
    write(content: Uint8Array) {
      files.set(this.uri, content);
    }
    delete() {
      files.delete(this.uri);
    }
  }
  class Directory {
    readonly uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return directories.has(this.uri);
    }
    create() {
      directories.add(this.uri);
    }
  }
  return { File, Directory, Paths: { document: 'file:///documents' } };
});

const launchImageLibraryAsync = jest.fn();
const requestMediaLibraryPermissionsAsync = jest.fn();
const launchCameraAsync = jest.fn();
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...args: unknown[]) => launchImageLibraryAsync(...args),
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) =>
    requestMediaLibraryPermissionsAsync(...args),
  launchCameraAsync: (...args: unknown[]) => launchCameraAsync(...args),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' },
}));

const CACHE = 'file:///cache/ImagePicker/ABC.jpg';

/** A JPEG whose EXIF carries a GPS latitude reference, as a phone writes it. */
const jpegWithLocation = (): Uint8Array => {
  const exif = [
    ...Buffer.from('Exif\0\0MM\0\x2a\0\0\0\x08\0\x01', 'latin1'),
    ...[0x88, 0x25, 0, 4, 0, 0, 0, 1, 0, 0, 0, 26],
    ...[0, 0, 0, 0],
    ...Buffer.from('GPS 51N 0W', 'latin1'),
  ];
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe1,
    0,
    exif.length + 2,
    ...exif,
    0xff,
    0xda,
    0,
    2,
    1,
    2,
    3,
    0xff,
    0xd9,
  ]);
};

const picked = (uri = CACHE, width = 3024, height = 4032) => ({
  canceled: false,
  assets: [{ uri, width, height, type: 'image' }],
});

beforeEach(() => {
  files.clear();
  directories.clear();
  jest.clearAllMocks();
});

describe('pickTargetPhoto', () => {
  it('opens the system picker for one image, without editing, EXIF or base64', async () => {
    launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });

    await pickTargetPhoto();

    // allowsEditing switches iOS to UIImagePickerController and Android to a
    // third-party crop activity; the system pickers are what need no permission.
    expect(launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: false,
        exif: false,
        base64: false,
      })
    );
  });

  it('never asks for a photo-library permission, or for the camera', async () => {
    launchImageLibraryAsync.mockResolvedValue(picked());
    files.set(CACHE, jpegWithLocation());

    await pickTargetPhoto();

    expect(requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    expect(launchCameraAsync).not.toHaveBeenCalled();
  });

  it('resolves undefined when the shooter cancels', async () => {
    launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });

    expect(await pickTargetPhoto()).toBeUndefined();
    expect(files.size).toBe(0);
  });

  it('keeps a copy in the app documents, without the location', async () => {
    launchImageLibraryAsync.mockResolvedValue(picked());
    files.set(CACHE, jpegWithLocation());

    const photo = await pickTargetPhoto();

    expect(photo?.uri).toMatch(/^file:\/\/\/documents\/targets\/target-\d+\.jpg$/);
    const kept = files.get(photo?.uri as string) as Uint8Array;
    expect(Buffer.from(kept).includes(Buffer.from('GPS'))).toBe(false);
    expect([...kept.slice(0, 2)]).toEqual([0xff, 0xd8]);
  });

  it('deletes the picker copy, which still has the location in it', async () => {
    launchImageLibraryAsync.mockResolvedValue(picked());
    files.set(CACHE, jpegWithLocation());

    await pickTargetPhoto();

    expect(files.has(CACHE)).toBe(false);
  });

  it('records the photo shape as height over width', async () => {
    launchImageLibraryAsync.mockResolvedValue(picked(CACHE, 3000, 4000));
    files.set(CACHE, jpegWithLocation());

    expect((await pickTargetPhoto())?.aspectRatio).toBeCloseTo(4 / 3, 12);
  });

  it('keeps nothing when the photo cannot be cleaned', async () => {
    launchImageLibraryAsync.mockResolvedValue(picked('file:///cache/ImagePicker/X.heic'));
    files.set('file:///cache/ImagePicker/X.heic', new Uint8Array([0, 0, 0, 0x18, 0x66]));

    await expect(pickTargetPhoto()).rejects.toThrow(UnsupportedImageError);
    expect([...files.keys()].filter((k) => k.includes('/documents/'))).toEqual([]);
  });
});

describe('deleteTargetPhoto', () => {
  it('deletes a kept photo', () => {
    files.set('file:///documents/targets/target-1.jpg', new Uint8Array([1]));

    deleteTargetPhoto('file:///documents/targets/target-1.jpg');

    expect(files.size).toBe(0);
  });

  it('refuses to delete anything outside the target photo directory', () => {
    files.set('file:///documents/backup.json', new Uint8Array([1]));

    deleteTargetPhoto('file:///documents/backup.json');

    expect(files.size).toBe(1);
  });
});
