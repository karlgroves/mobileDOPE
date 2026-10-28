/**
 * Removes location and other identifying metadata from a target photo (#63).
 *
 * A phone photo normally records where it was taken: GPS latitude and longitude
 * in EXIF, and often again in XMP. `PRIVACY.md` says longitude is never recorded
 * and latitude is coarsened to about 11 km before anything is stored, so a
 * target photo copied into the app with its EXIF intact would make both
 * statements false -- and a full backup that one day includes target photos
 * would carry the exact position of every range the shooter has used.
 *
 * Neither platform can be relied on to have removed it already. iOS's photo
 * picker includes location unless the user switches it off in the picker's
 * options, and expo-image-picker on Android copies the GPS tags into the file it
 * re-encodes. So the bytes are cleaned here, before they are written into the
 * app's storage, and the result is the only copy kept.
 *
 * ## What is kept
 *
 * Only what is needed to draw the image correctly: the compressed image data, the
 * structural segments, the colour profile (an iPhone photo is in Display P3, and
 * without its profile it renders washed out) and the EXIF orientation -- a
 * portrait phone photo is stored sideways and relies on that tag to be shown
 * upright. The orientation is written into a new, minimal EXIF block holding
 * that one tag and nothing else, rather than kept by editing the original block,
 * because "everything except GPS" is a list that would need to be right forever.
 *
 * JPEG and PNG are what the picker produces with the options the app passes; any
 * other format is refused rather than stored uncleaned.
 */

/** The image is not one this can clean, or is malformed. */
export class UnsupportedImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedImageError';
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const startsWith = (bytes: Uint8Array, prefix: number[]): boolean =>
  bytes.length >= prefix.length && prefix.every((b, i) => bytes[i] === b);

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(start, start + length));

// --- JPEG ---------------------------------------------------------------

const SOI = 0xd8;
const SOS = 0xda;
const APP0 = 0xe0;
const APP1 = 0xe1;
const ORIENTATION_TAG = 0x0112;
const UPRIGHT = 1;

/**
 * JPEG segments that can carry who, where or when. APP1 is EXIF and XMP; APP12
 * and APP13 are Ducky and Photoshop/IPTC (which has its own location fields);
 * COM is free text. The remaining APPn segments describe how to decode the image
 * -- JFIF, the ICC profile, Adobe's colour transform -- and are kept.
 */
const isMetadataSegment = (marker: number): boolean =>
  marker === APP1 || marker === 0xec || marker === 0xed || marker === 0xfe;

/** Markers with no length field. */
const isStandalone = (marker: number): boolean =>
  marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);

/**
 * The orientation tag from an EXIF APP1 payload, or undefined if it has none or
 * the block is malformed. Reads IFD0 only, which is where the tag lives.
 */
const readOrientation = (payload: Uint8Array): number | undefined => {
  if (payload.length < 14 || ascii(payload, 0, 4) !== 'Exif') return undefined;
  const tiff = payload.subarray(6);
  const order = ascii(tiff, 0, 2);
  if (order !== 'II' && order !== 'MM') return undefined;
  const little = order === 'II';
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const ifd = view.getUint32(4, little);
  if (ifd + 2 > tiff.length) return undefined;
  const entries = view.getUint16(ifd, little);
  for (let i = 0; i < entries; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > tiff.length) return undefined;
    if (view.getUint16(entry, little) === ORIENTATION_TAG) {
      const value = view.getUint16(entry + 8, little);
      return value >= 1 && value <= 8 ? value : undefined;
    }
  }
  return undefined;
};

/** A complete APP1 segment holding EXIF with the orientation tag and nothing else. */
const orientationSegment = (orientation: number): number[] => [
  0xff,
  APP1,
  0x00,
  0x22, // length 34: itself (2) + payload (32)
  ...[0x45, 0x78, 0x69, 0x66, 0x00, 0x00], // "Exif\0\0"
  ...[0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08], // "MM", 42, IFD0 at 8
  ...[0x00, 0x01], // one entry
  ...[0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01], // orientation, SHORT, count 1
  ...[0x00, orientation, 0x00, 0x00], // value, padded
  ...[0x00, 0x00, 0x00, 0x00], // no next IFD
];

/** One header segment: its marker, where it starts, where its payload starts, where it ends. */
interface Segment {
  marker: number;
  start: number;
  payload: number;
  end: number;
}

const EOI = 0xd9;

/**
 * Where the primary image ends: just past the first EOI after `from`, or the
 * end of the file if it has none.
 *
 * Anything after that EOI is not this image. It is where an MPF/MPO file keeps
 * its secondary images -- an iPhone HDR gain map, a depth map, a preview --
 * each a complete JPEG with EXIF of its own, and where some cameras append
 * trailer data. Keeping it would keep their metadata, GPS included.
 *
 * The first `FF D9` is the EOI: inside entropy-coded data a `0xFF` is always
 * followed by `0x00` (byte stuffing) or a restart marker, and the markers
 * between a progressive JPEG's scans are never D9.
 */
const primaryImageEnd = (bytes: Uint8Array, from: number): number => {
  for (let i = from; i < bytes.length - 1; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === EOI) return i + 2;
  }
  return bytes.length;
};

/**
 * The segment starting at `start`. Start-of-scan "ends" at the primary image's
 * EOI: everything up to it is compressed image data, and everything after it
 * is dropped (see `primaryImageEnd`).
 */
const segmentAt = (bytes: Uint8Array, start: number): Segment => {
  if (start + 1 >= bytes.length || bytes[start] !== 0xff) {
    throw new UnsupportedImageError('JPEG ended before its image data');
  }
  let markerAt = start + 1;
  while (bytes[markerAt] === 0xff && markerAt < bytes.length - 1) markerAt++; // fill bytes
  const marker = bytes[markerAt];

  if (marker === SOS) {
    return { marker, start, payload: markerAt + 1, end: primaryImageEnd(bytes, markerAt + 1) };
  }
  if (isStandalone(marker)) return { marker, start, payload: markerAt + 1, end: markerAt + 1 };

  const length = markerAt + 2 < bytes.length ? (bytes[markerAt + 1] << 8) | bytes[markerAt + 2] : 0;
  const end = markerAt + 1 + length;
  if (length < 2 || end > bytes.length) throw new UnsupportedImageError('Truncated JPEG segment');
  return { marker, start, payload: markerAt + 3, end };
};

const stripJpeg = (bytes: Uint8Array): Uint8Array => {
  const kept: Uint8Array[] = [bytes.subarray(0, 2)];
  let orientation: number | undefined;
  let afterApp0 = 1; // index in `kept` to insert the rebuilt EXIF at

  for (let i = 2, done = false; !done; ) {
    const segment = segmentAt(bytes, i);
    done = segment.marker === SOS;
    if (!isMetadataSegment(segment.marker)) {
      kept.push(bytes.subarray(segment.start, segment.end));
      if (segment.marker === APP0) afterApp0 = kept.length;
    } else if (segment.marker === APP1 && orientation === undefined) {
      orientation = readOrientation(bytes.subarray(segment.payload, segment.end));
    }
    i = segment.end;
  }

  if (orientation !== undefined && orientation !== UPRIGHT) {
    kept.splice(afterApp0, 0, new Uint8Array(orientationSegment(orientation)));
  }
  return concat(kept);
};

// --- PNG ----------------------------------------------------------------

/** PNG chunks that carry metadata rather than pixels: EXIF and the three text kinds. */
const PNG_METADATA = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt']);

const stripPng = (bytes: Uint8Array): Uint8Array => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kept: Uint8Array[] = [bytes.subarray(0, 8)];
  let i = 8;
  while (i < bytes.length) {
    if (i + 8 > bytes.length) throw new UnsupportedImageError('Truncated PNG chunk');
    const length = view.getUint32(i);
    const end = i + 12 + length; // length, type, data, CRC
    if (end > bytes.length) throw new UnsupportedImageError('Truncated PNG chunk');
    const type = ascii(bytes, i + 4, 4);
    if (!PNG_METADATA.has(type)) kept.push(bytes.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  return concat(kept);
};

// ------------------------------------------------------------------------

const concat = (parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

/**
 * `bytes` without location or other identifying metadata.
 *
 * @throws UnsupportedImageError for anything that is not a well-formed JPEG or
 *   PNG. The caller must not store the original instead.
 */
export const stripImageMetadata = (bytes: Uint8Array): Uint8Array => {
  if (bytes.length > 2 && bytes[0] === 0xff && bytes[1] === SOI) return stripJpeg(bytes);
  if (startsWith(bytes, PNG_SIGNATURE)) return stripPng(bytes);
  throw new UnsupportedImageError('Only JPEG and PNG photos can be used as a target');
};
