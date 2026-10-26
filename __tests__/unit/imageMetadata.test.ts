import { stripImageMetadata, UnsupportedImageError } from '../../src/utils/imageMetadata';

/**
 * A target photo is kept without the metadata that says where it was taken (#63).
 *
 * A phone photo usually carries the GPS position it was taken at, in EXIF and
 * often again in XMP. `CLAUDE.md` and `PRIVACY.md` both say longitude is never
 * recorded and latitude is coarsened to ~11 km before it is stored -- a target
 * photo copied into the app with its EXIF intact would quietly make both untrue.
 * Neither platform's picker can be relied on to remove it: iOS's PHPicker
 * includes location by default, and expo-image-picker on Android copies the GPS
 * tags across when it re-encodes.
 *
 * The images here are built byte by byte, so every assertion is about a
 * specific segment rather than about whatever a sample file happens to contain.
 */

const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));
const u16 = (n: number): number[] => [(n >> 8) & 0xff, n & 0xff];
const u32 = (n: number): number[] => [
  (n >>> 24) & 0xff,
  (n >> 16) & 0xff,
  (n >> 8) & 0xff,
  n & 0xff,
];

/** A JPEG marker segment: FF, marker, big-endian length (which counts itself), payload. */
const segment = (marker: number, payload: number[]): number[] => [
  0xff,
  marker,
  ...u16(payload.length + 2),
  ...payload,
];

/**
 * An EXIF APP1 payload with IFD0 holding an orientation and a pointer to a GPS
 * IFD with a latitude reference -- the shape a phone writes.
 */
const exifPayload = (orientation: number, littleEndian = false): number[] => {
  const w16 = (n: number) => (littleEndian ? u16(n).reverse() : u16(n));
  const w32 = (n: number) => (littleEndian ? u32(n).reverse() : u32(n));
  // TIFF header (8) + IFD0: count, 2 entries, next-IFD (2 + 24 + 4) = 38 -> GPS IFD at 38.
  const tiff = [
    ...ascii(littleEndian ? 'II' : 'MM'),
    ...w16(42),
    ...w32(8),
    ...w16(2),
    ...w16(0x0112),
    ...w16(3),
    ...w32(1),
    ...w16(orientation),
    0,
    0,
    ...w16(0x8825),
    ...w16(4),
    ...w32(1),
    ...w32(38),
    ...w32(0),
    // GPS IFD: one entry, GPSLatitudeRef = "N".
    ...w16(1),
    ...w16(0x0001),
    ...w16(2),
    ...w32(2),
    ...ascii('N'),
    0,
    0,
    0,
    ...w32(0),
  ];
  return [...ascii('Exif'), 0, 0, ...tiff];
};

const SOI = [0xff, 0xd8];
const APP0 = segment(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const ICC = segment(0xe2, [...ascii('ICC_PROFILE'), 0, 1, 1, 9, 9, 9]);
const XMP = segment(0xe1, [
  ...ascii('http://ns.adobe.com/xap/1.0/'),
  0,
  ...ascii('<exif:GPSLatitude>51,30N</exif:GPSLatitude>'),
]);
const IPTC = segment(0xed, [...ascii('Photoshop 3.0'), 0, 1, 2, 3]);
const COMMENT = segment(0xfe, ascii('shot at the club range'));
const DQT = segment(0xdb, [0, ...new Array(64).fill(1)]);
const SOS_AND_DATA = [
  ...segment(0xda, [1, 1, 0, 0, 0x3f, 0]),
  0x12,
  0x34,
  0xff,
  0x00,
  0x56,
  0xff,
  0xd9,
];

const jpeg = (...parts: number[][]): Uint8Array => new Uint8Array(parts.flat());

/** Every marker byte of the header segments, in order, stopping at start-of-scan. */
const markers = (bytes: Uint8Array): number[] => {
  const found: number[] = [];
  let i = 2;
  while (i < bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1];
    found.push(marker);
    if (marker === 0xda) break;
    i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
  }
  return found;
};

const contains = (bytes: Uint8Array, text: string): boolean =>
  Buffer.from(bytes).includes(Buffer.from(text, 'latin1'));

describe('stripImageMetadata, JPEG', () => {
  const photo = () =>
    jpeg(SOI, APP0, segment(0xe1, exifPayload(1)), XMP, IPTC, COMMENT, ICC, DQT, SOS_AND_DATA);

  it('removes EXIF, XMP, IPTC and comments', () => {
    const out = stripImageMetadata(photo());

    expect(markers(out)).toEqual([0xe0, 0xe2, 0xdb, 0xda]);
    expect(contains(out, 'Exif')).toBe(false);
    expect(contains(out, 'GPSLatitude')).toBe(false);
    expect(contains(out, 'Photoshop')).toBe(false);
    expect(contains(out, 'club range')).toBe(false);
  });

  it('keeps the colour profile and the image itself byte for byte', () => {
    const out = stripImageMetadata(photo());

    expect(contains(out, 'ICC_PROFILE')).toBe(true);
    // Everything from start-of-scan on is the compressed image: untouched.
    expect([...out.slice(out.length - SOS_AND_DATA.length)]).toEqual(SOS_AND_DATA);
  });

  it.each([false, true])(
    'keeps the orientation, and only the orientation (little-endian: %s)',
    (littleEndian) => {
      // A portrait phone photo is stored sideways with orientation 6. Dropping
      // the tag with the rest of EXIF would show every portrait target on its side.
      const out = stripImageMetadata(
        jpeg(SOI, APP0, segment(0xe1, exifPayload(6, littleEndian)), DQT, SOS_AND_DATA)
      );

      expect(markers(out)).toEqual([0xe0, 0xe1, 0xdb, 0xda]);
      // The rebuilt EXIF, exactly: a big-endian TIFF header, then IFD0 with a
      // single entry -- orientation, SHORT, 6 -- and no next IFD. No GPS pointer.
      const start = APP0.length + 2;
      expect([...out.slice(start, start + 36)]).toEqual(
        segment(0xe1, [
          ...ascii('Exif'),
          0,
          0,
          ...ascii('MM'),
          ...u16(42),
          ...u32(8),
          ...u16(1),
          ...u16(0x0112),
          ...u16(3),
          ...u32(1),
          ...u16(6),
          0,
          0,
          ...u32(0),
        ])
      );
      // Cleaning a cleaned file changes nothing.
      expect(stripImageMetadata(out)).toEqual(out);
    }
  );

  it('adds no EXIF at all when the orientation is already upright', () => {
    const out = stripImageMetadata(jpeg(SOI, segment(0xe1, exifPayload(1)), DQT, SOS_AND_DATA));
    expect(markers(out)).toEqual([0xdb, 0xda]);
  });

  it('refuses a truncated file rather than writing half of one', () => {
    const whole = photo();
    expect(() => stripImageMetadata(whole.slice(0, 30))).toThrow(UnsupportedImageError);
  });
});

describe('stripImageMetadata, PNG', () => {
  const chunk = (type: string, data: number[]): number[] => [
    ...u32(data.length),
    ...ascii(type),
    ...data,
    0,
    0,
    0,
    0, // CRC: not checked here, and carried through unchanged for kept chunks
  ];
  const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const png = new Uint8Array([
    ...SIGNATURE,
    ...chunk('IHDR', new Array(13).fill(1)),
    ...chunk('eXIf', exifPayload(1).slice(6)),
    ...chunk('iTXt', ascii('XML:com.adobe.xmp\0GPSLatitude')),
    ...chunk('tEXt', ascii('Comment\0club range')),
    ...chunk('IDAT', [9, 9, 9]),
    ...chunk('IEND', []),
  ]);

  it('removes eXIf and text chunks and keeps the image chunks', () => {
    const out = stripImageMetadata(png);

    expect(contains(out, 'eXIf')).toBe(false);
    expect(contains(out, 'GPSLatitude')).toBe(false);
    expect(contains(out, 'club range')).toBe(false);
    for (const kept of ['IHDR', 'IDAT', 'IEND']) expect(contains(out, kept)).toBe(true);
    expect([...out.slice(0, 8)]).toEqual(SIGNATURE);
  });
});

describe('stripImageMetadata, anything else', () => {
  it('refuses formats it cannot clean, rather than keeping them as they are', () => {
    // HEIC carries EXIF too. A format this cannot parse is one it cannot vouch
    // for, so it is refused rather than stored with its location intact.
    const heic = new Uint8Array([0, 0, 0, 0x18, ...ascii('ftypheic'), 0, 0, 0, 0]);
    expect(() => stripImageMetadata(heic)).toThrow(UnsupportedImageError);
  });
});
