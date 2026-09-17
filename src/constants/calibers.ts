/**
 * The caliber database (#67, "add caliber database management").
 *
 * There were three caliber lists in this repo and no two of them agreed:
 *
 * 1. `COMMON_CALIBERS` here, with categories and descriptions, imported by
 *    nothing at all.
 * 2. `CALIBER_OPTIONS`, duplicated character-for-character in
 *    `RifleProfileForm` and `AmmoProfileForm` -- the only list a user ever saw.
 * 3. `CALIBER_DIAMETER_MAP` in `spinDrift.ts`, the only one the solver reads.
 *
 * Lists 2 and 3 overlapped on 15 of the 34 selectable calibers. The other 19
 * fell through to a guesser that extracts digits from the name, and two of them
 * came out badly wrong: `5.45x39mm` resolved to 0.45" against a true 0.220", and
 * `7.92x57mm` to 0.92" against a true 0.323". Spin drift scales with bullet
 * diameter, so those are not rounding errors -- they are a windage correction
 * computed for a bullet three times too fat, offered to the user with no
 * indication that anything was estimated.
 *
 * This is the single source of truth. A caliber the app offers carries its own
 * diameter, so nothing the picker can produce ever reaches the guesser.
 *
 * Diameters are bullet (groove) diameter in inches, which is what the spin drift
 * term needs -- not bore diameter and not the number in the cartridge name. The
 * two differ often enough that the name is not a safe source: `.30-30` fires a
 * 0.308" bullet, `.22 LR` a 0.223", and `7.92x57mm` a 0.323".
 */

/** One selectable caliber. */
export interface Caliber {
  /** Stored on rifle and ammo profiles, and used as the lookup key. */
  value: string;
  /** What the picker shows. */
  label: string;
  /** Bullet (groove) diameter in inches. */
  diameter: number;
}

export const CALIBERS: Caliber[] = [
  { value: '.17 HM2', label: '.17 HM2 (Hornady Mach 2)', diameter: 0.172 },
  { value: '.17 HMR', label: '.17 HMR (Hornady Magnum Rimfire)', diameter: 0.172 },
  { value: '.17 WSM', label: '.17 WSM (Winchester Super Magnum)', diameter: 0.172 },
  { value: '.21 Sharp', label: '.21 Sharp', diameter: 0.2105 },
  { value: '.22 CB', label: '.22 CB', diameter: 0.223 },
  { value: '.22 Creedmoor', label: '.22 Creedmoor', diameter: 0.224 },
  { value: '.22 Long', label: '.22 Long', diameter: 0.223 },
  { value: '.22 WMR', label: '.22 Mag (.22 WMR)', diameter: 0.224 },
  { value: '.22 Short', label: '.22 Short', diameter: 0.223 },
  { value: '.22 Win Auto', label: '.22 Win Auto', diameter: 0.223 },
  { value: '.22 WRF', label: '.22 Win Rimfire (.22 WRF)', diameter: 0.224 },
  { value: '.223 Remington', label: '.223 Remington', diameter: 0.224 },
  { value: '.22LR', label: '.22LR', diameter: 0.223 },
  { value: '.243 Win', label: '.243 Win', diameter: 0.243 },
  { value: '.25 Stevens Short', label: '.25 Stevens Short', diameter: 0.251 },
  { value: '.270 Win', label: '.270 Win', diameter: 0.277 },
  { value: '.30-06', label: '.30-06', diameter: 0.308 },
  { value: '.30-30 Win', label: '.30-30 Win', diameter: 0.308 },
  { value: '.300 AAC Blackout', label: '.300 AAC Blackout (7.62x35mm)', diameter: 0.308 },
  { value: '.300 Win Mag', label: '.300 Win Mag', diameter: 0.308 },
  { value: '.308 Winchester', label: '.308/7.62x51mm (.308 Winchester)', diameter: 0.308 },
  { value: '.32 Long Rimfire', label: '.32 Long Rimfire', diameter: 0.316 },
  { value: '.45-70', label: '.45-70', diameter: 0.458 },
  { value: '5.45x39mm', label: '5.45x39mm', diameter: 0.22 },
  { value: '5.56 NATO', label: '5.56x45mm NATO', diameter: 0.224 },
  { value: '6.5 Creedmoor', label: '6.5mm Creedmoor', diameter: 0.264 },
  { value: '6.5 Grendel', label: '6.5mm Grendel', diameter: 0.264 },
  { value: '6mm PRC', label: '6mm PRC', diameter: 0.243 },
  { value: '6mm ARC', label: '6mm ARC', diameter: 0.243 },
  { value: '7.62x39mm', label: '7.62x39mm', diameter: 0.311 },
  { value: '7.62x54R', label: '7.62x54R', diameter: 0.311 },
  { value: '7mm PRC', label: '7mm PRC', diameter: 0.284 },
  { value: '7.92x57mm', label: '7.92x57mm (8x57 JS)', diameter: 0.323 },
  { value: '9mm Flobert', label: '9mm Flobert', diameter: 0.36 },
];

/**
 * The picker options, derived rather than written out.
 *
 * Both profile forms import this. Two hand-maintained copies is how the lists
 * drifted apart in the first place.
 */
export const CALIBER_OPTIONS: { label: string; value: string }[] = CALIBERS.map(
  ({ label, value }) => ({ label, value })
);

/** Case-insensitive index, built once. */
const BY_VALUE = new Map(CALIBERS.map((caliber) => [caliber.value.toLowerCase(), caliber]));

/**
 * Bullet diameter for a caliber this app offers, in inches.
 *
 * Returns undefined rather than a guess for anything else -- an imported profile
 * or a caliber from an older version of the list. The caller decides what to do
 * with not knowing; a plausible-looking wrong number is worse than a gap,
 * because nothing downstream can tell it apart from a real measurement.
 *
 * @param value - The caliber as stored on a profile.
 */
export const caliberDiameter = (value: string | undefined | null): number | undefined => {
  if (typeof value !== 'string') return undefined;
  return BY_VALUE.get(value.trim().toLowerCase())?.diameter;
};
