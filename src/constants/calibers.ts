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
 * 0.308" bullet and `7.92x57mm` a 0.323".
 *
 * Where a caliber also appears in `CALIBER_DIAMETER_MAP` -- the legacy lookup
 * `spinDrift.ts` still uses for imported profiles -- the two must agree, and a
 * test enforces it. The .22 rimfire family is 0.224 here for that reason: 0.223
 * is equally defensible in the literature, but a cartridge resolving one way
 * from the picker and another from an import is worse than either value, and
 * the difference is well below what the spin drift term resolves anyway.
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
  { value: '.22 CB', label: '.22 CB', diameter: 0.224 },
  { value: '.22 Creedmoor', label: '.22 Creedmoor', diameter: 0.224 },
  { value: '.22 Long', label: '.22 Long', diameter: 0.224 },
  { value: '.22 WMR', label: '.22 Mag (.22 WMR)', diameter: 0.224 },
  { value: '.22 Short', label: '.22 Short', diameter: 0.224 },
  { value: '.22 Win Auto', label: '.22 Win Auto', diameter: 0.224 },
  { value: '.22 WRF', label: '.22 Win Rimfire (.22 WRF)', diameter: 0.224 },
  { value: '.223 Remington', label: '.223 Remington', diameter: 0.224 },
  { value: '.22LR', label: '.22LR', diameter: 0.224 },
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
 * A caliber the shooter added (#67). The name is both what is stored on a
 * profile and what the picker shows; the diameter is required for the same
 * reason the seeded table carries one -- spin drift needs it, and the name is
 * not a safe source of it.
 */
export interface CustomCaliber {
  name: string;
  /** Bullet (groove) diameter in inches. */
  diameter: number;
}

/**
 * The picker options, derived rather than written out.
 *
 * Both profile forms read these, through `useCaliberOptions`, which adds the
 * shooter's own after them. Two hand-maintained copies is how the lists
 * drifted apart in the first place.
 */
export const CALIBER_OPTIONS: { label: string; value: string }[] = CALIBERS.map(
  ({ label, value }) => ({ label, value })
);

/**
 * The seeded options followed by the shooter's custom calibers, each marked
 * "(custom)" so it reads as theirs rather than as one the app vouches for.
 */
export const caliberOptionsWith = (
  custom: readonly CustomCaliber[]
): { label: string; value: string }[] => [
  ...CALIBER_OPTIONS,
  ...custom.map(({ name }) => ({ label: `${name} (custom)`, value: name })),
];

/** Case-insensitive index, built once. */
const BY_VALUE = new Map(CALIBERS.map((caliber) => [caliber.value.toLowerCase(), caliber]));

/** Seeded labels, lower-cased, so a custom name cannot impersonate one. */
const SEEDED_LABELS = new Set(CALIBERS.map((caliber) => caliber.label.toLowerCase()));

/** Whether `name` is already a built-in caliber, by value or by label. */
export const isSeededCaliber = (name: string): boolean => {
  const key = name.trim().toLowerCase();
  return BY_VALUE.has(key) || SEEDED_LABELS.has(key);
};

/**
 * The custom calibers' diameters, by lower-cased name.
 *
 * Module state rather than an argument because the solver reaches
 * `caliberDiameter` from deep inside `utils/ballistics.ts` with only the
 * profile's caliber string, and threading the settings store through the
 * solver for one lookup would couple the maths to the UI. The app store keeps
 * this in step with the saved list (`setCustomCalibers` on load and on every
 * change), so it is never staler than the settings themselves.
 */
let customDiameters = new Map<string, number>();

/** Replace the custom calibers `caliberDiameter` knows about. */
export const setCustomCalibers = (custom: readonly CustomCaliber[]): void => {
  customDiameters = new Map(custom.map(({ name, diameter }) => [name.toLowerCase(), diameter]));
};

/**
 * Bullet diameter for a caliber this app offers, built in or custom, in inches.
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
  const key = value.trim().toLowerCase();
  return BY_VALUE.get(key)?.diameter ?? customDiameters.get(key);
};
