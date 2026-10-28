/**
 * Target photos: choosing one, keeping a clean copy, and removing it again (#63).
 *
 * ## No permission is asked for
 *
 * The photo is chosen through `launchImageLibraryAsync` with editing off, which
 * expo-image-picker 55 serves with the system pickers that run outside the app:
 * PHPickerViewController on iOS and the Android photo picker (`PickVisualMedia`).
 * Both hand back only the photo the shooter chose and need no photo-library or
 * storage permission, and the app requests none -- there is deliberately no call
 * to `requestMediaLibraryPermissionsAsync` anywhere, no `expo-image-picker`
 * config plugin (it would seed photo-library and camera usage strings), and
 * `app.config.ts` keeps CAMERA and READ_MEDIA_IMAGES blocked.
 *
 * `allowsEditing` must stay off. On iOS it swaps PHPicker for the older
 * UIImagePickerController, and on Android it adds a crop activity from a
 * third-party library whose manifest this project has not audited; neither is
 * needed to mark a target. `exif` stays off too: on the UIImagePickerController
 * path expo-image-picker reads EXIF through the photo library itself.
 *
 * ## A clean copy, in the app's own storage
 *
 * The picker returns a file in a cache directory the OS may clear, so the photo
 * is copied into `Documents/targets/`. What is written is the photo with its
 * location and other metadata removed (`src/utils/imageMetadata.ts`): a phone
 * photo carries the GPS position it was taken at, which `PRIVACY.md` says the
 * app never records. The uncleaned cache file is deleted.
 */

import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { stripImageMetadata } from '../utils/imageMetadata';

/** A photo chosen as a target, after it has been cleaned and kept. */
export interface TargetPhoto {
  /** The kept copy, under the app's documents directory. */
  uri: string;
  /** Height divided by width, as the picker measured the image. */
  aspectRatio: number;
}

const photoDirectory = (): Directory => new Directory(Paths.document, 'targets');

const extensionFor = (bytes: Uint8Array): 'jpg' | 'png' => (bytes[0] === 0x89 ? 'png' : 'jpg');

/**
 * Lets the shooter choose a photo of their target, and keeps a clean copy.
 *
 * Resolves undefined when the shooter cancels.
 *
 * @throws UnsupportedImageError when the photo is not a JPEG or PNG -- which, with
 *   the options below, is rare -- rather than keeping a file it cannot clean.
 */
export const pickTargetPhoto = async (): Promise<TargetPhoto | undefined> => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    allowsMultipleSelection: false,
    exif: false,
    base64: false,
    // Below 1 so both platforms re-encode to JPEG instead of handing over the
    // original file -- an iPhone's HEIC, which this cannot clean, among them.
    quality: 0.9,
    // iOS: transcode HEIC to the most compatible format (JPEG) before handing over.
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled) return undefined;

  const asset = result.assets[0];
  if (!asset || !(asset.width > 0) || !(asset.height > 0)) {
    throw new Error('The chosen photo has no size');
  }

  const picked = new File(asset.uri);
  try {
    const cleaned = stripImageMetadata(await picked.bytes());

    const directory = photoDirectory();
    if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
    const kept = new File(directory, `target-${Date.now()}.${extensionFor(cleaned)}`);
    kept.create({ overwrite: true });
    kept.write(cleaned);

    return { uri: kept.uri, aspectRatio: asset.height / asset.width };
  } finally {
    // The picker's copy still has its metadata. It is in a cache directory, but
    // nothing says when the OS will get round to clearing it.
    try {
      if (picked.exists) picked.delete();
    } catch {
      // Not ours to insist on: the picker may already have removed it.
    }
  }
};

/**
 * Deletes a kept target photo.
 *
 * Only ever deletes inside `Documents/targets/`: the uri comes from the database,
 * and a row that somehow named another file must not be able to remove it.
 */
export const deleteTargetPhoto = (uri: string): void => {
  const { uri: base } = photoDirectory();
  const prefix = base.endsWith('/') ? base : `${base}/`;
  if (!uri.startsWith(prefix) || uri.includes('..')) return;
  const file = new File(uri);
  if (file.exists) file.delete();
};
