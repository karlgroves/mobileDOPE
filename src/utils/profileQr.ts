/**
 * Profile QR codes (#66, ADR-016).
 *
 * ADR-016 settles how a profile travels by QR: the code holds a
 * `mobiledope://` deep link, the operating system's own camera scans it, and
 * the app receives the link. This app never opens a camera, so the blocked
 * CAMERA permission in `app.config.ts` stays blocked.
 *
 * This module builds that link and draws it as an SVG string. The DOPE card is
 * HTML rendered by `expo-print`, so the SVG drops straight into it and needs no
 * native drawing library.
 *
 * ## The link format (v1)
 *
 * `mobiledope://import/profile?v=1&rn=...&rc=...` -- short query keys, one per
 * field, each value percent-encoded. It is a defined format rather than
 * `JSON.stringify` because a QR's capacity is small and a printed code that
 * holds too much does not scan at a bench. `v` is the format version, so a
 * later importer can refuse a format it does not know instead of guessing.
 *
 * Only fields the solver needs, plus names to tell loads apart, are included.
 * Notes, optic details, powder and lot number stay off the card: they are long,
 * and they are the shooter's own records rather than load data.
 *
 * ## What is not here yet
 *
 * The app does not handle `import/profile` yet. Until that route lands, a
 * scanned code opens the app without importing anything. The link payload is
 * untrusted input, so whatever handles it must validate every field the way
 * file import does.
 */

import qrcode from 'qrcode-generator';

import { APP_SCHEME } from '../navigation/linking';

import { escapeHtml } from './formatting';

/** The deep-link path a profile QR points at. */
export const PROFILE_IMPORT_PATH = 'import/profile';

/** The link format version written into every code. */
export const SHARE_LINK_VERSION = 1;

/**
 * The longest link this will put in a code.
 *
 * At error correction level M, 256 characters needs a version 12 code (65
 * modules a side, 73 with the quiet zone). Printed one inch square, each
 * module is about a third of a millimetre, which a phone camera reads held
 * close to the card. A typical profile is nearer 175 characters (version 9).
 * Past the cap, the code gets too dense to trust on paper.
 */
export const MAX_SHARE_LINK_LENGTH = 256;

/** The rifle fields a code carries. */
export interface ShareableRifle {
  name: string;
  caliber: string;
  barrelLength: number;
  twistRate: string;
  zeroDistance: number;
  clickValueType: 'MIL' | 'MOA';
  clickValue: number;
  scopeHeight: number;
}

/** The load fields a code carries. */
export interface ShareableAmmo {
  name: string;
  manufacturer: string;
  bulletWeight: number;
  bulletType: string;
  ballisticCoefficientG1: number;
  ballisticCoefficientG7: number;
  muzzleVelocity: number;
}

/** A link to print, or why there is none. */
export type ShareLinkResult = { ok: true; url: string } | { ok: false; reason: string };

/** Colours for a drawn code. Light is the background and quiet zone. */
export interface QrColours {
  dark: string;
  light: string;
}

/**
 * Builds the profile-import link for one rifle and one load.
 *
 * Returns a reason instead of a link when the result would be too long to
 * scan reliably. A code that looks fine on paper and fails at the range is
 * worse than no code.
 *
 * @param rifle - The rifle on the card.
 * @param ammo - The load on the card.
 */
export const buildProfileShareLink = (
  rifle: ShareableRifle,
  ammo: ShareableAmmo
): ShareLinkResult => {
  // Order is fixed so the same profile always gives the same code.
  const fields: [string, string | number][] = [
    ['v', SHARE_LINK_VERSION],
    ['rn', rifle.name],
    ['rc', rifle.caliber],
    ['bl', rifle.barrelLength],
    ['tw', rifle.twistRate],
    ['z', rifle.zeroDistance],
    ['ct', rifle.clickValueType],
    ['cv', rifle.clickValue],
    ['sh', rifle.scopeHeight],
    ['an', ammo.name],
    ['am', ammo.manufacturer],
    ['bw', ammo.bulletWeight],
    ['bt', ammo.bulletType],
    ['g1', ammo.ballisticCoefficientG1],
    ['g7', ammo.ballisticCoefficientG7],
    ['mv', ammo.muzzleVelocity],
  ];

  // Built by hand rather than with URLSearchParams, whose React Native
  // implementation is incomplete.
  const query = fields
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');

  const url = `${APP_SCHEME}://${PROFILE_IMPORT_PATH}?${query}`;

  if (url.length > MAX_SHARE_LINK_LENGTH) {
    return {
      ok: false,
      reason:
        'Profile too long for a QR code that scans reliably. Shorten the rifle or load name to include one.',
    };
  }

  return { ok: true, url };
};

/** Modules of blank margin around the code, as the QR specification requires. */
const QUIET_ZONE = 4;

/**
 * Draws text as a QR code in an SVG string.
 *
 * Error correction level M (about 15% recoverable), which holds up to a
 * smudged or creased card without making the code much denser. Each dark
 * module is a 1x1 square on a viewBox measured in modules, so the code scales
 * to whatever size the card gives it with crisp edges.
 *
 * @param text - What the code holds.
 * @param colours - Dark modules and the background.
 */
export const renderQrSvg = (text: string, colours: QrColours): string => {
  // Type number 0 lets the encoder pick the smallest version that fits.
  const code = qrcode(0, 'M');
  code.addData(text, 'Byte');
  code.make();

  const count = code.getModuleCount();
  const size = count + QUIET_ZONE * 2;

  const modules: string[] = [];
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (code.isDark(row, col)) {
        modules.push(`M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`);
      }
    }
  }

  // No xmlns: the SVG is inline in the card's HTML, which needs none, and the
  // offline-first test rightly refuses any http URL in src/.
  return (
    `<svg viewBox="0 0 ${size} ${size}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="QR code">` +
    `<rect width="${size}" height="${size}" fill="${colours.light}"/>` +
    `<path fill="${colours.dark}" d="${modules.join('')}"/>` +
    `</svg>`
  );
};

/**
 * The QR section of a printed DOPE card.
 *
 * It starts a new page, so on a card printed double-sided the code is on the
 * back and the table on the front keeps its full size. The names and caption
 * sit beside the one-inch code rather than above and below it, so the section
 * is one inch tall: the condensed card's 1.5 inch page leaves only about 1.1
 * inches inside its margin and padding, and a stacked layout would spill onto
 * a third page. When the profile is too long for a code, the section says so
 * instead.
 *
 * @param rifle - The rifle on the card.
 * @param ammo - The load on the card.
 * @param colours - The card's colours, so night vision stays red on black.
 */
export const renderProfileQrSection = (
  rifle: ShareableRifle,
  ammo: ShareableAmmo,
  colours: QrColours
): string => {
  const link = buildProfileShareLink(rifle, ammo);
  const label = `${escapeHtml(rifle.name)} | ${escapeHtml(ammo.name)}`;

  if (!link.ok) {
    return `
  <div style="page-break-before: always; text-align: center;">
    <div style="font-weight: bold; margin-bottom: 4px;">${label}</div>
    <div>${escapeHtml(link.reason)}</div>
  </div>`;
  }

  return `
  <div style="page-break-before: always; display: flex; align-items: center; justify-content: center; gap: 8px;">
    <div style="width: 1in; height: 1in; flex: none;">${renderQrSvg(link.url, colours)}</div>
    <div>
      <div style="font-weight: bold; margin-bottom: 4px;">${label}</div>
      <div>Scan with your phone camera to import this load</div>
    </div>
  </div>`;
};
