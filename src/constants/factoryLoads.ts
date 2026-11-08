/**
 * Factory loads: manufacturer-published ballistic coefficients and muzzle
 * velocities, bundled with the app (#225).
 *
 * The only thing this table does is pre-fill the ammunition form. Every value
 * it fills stays editable, and nothing else in the app reads it: a saved
 * profile holds its own copy of the numbers, so editing or removing an entry
 * here never changes a load the shooter has already saved.
 *
 * Rules for an entry, which `__tests__/unit/factoryLoads.test.ts` enforces
 * where it can:
 *
 * - **Copied, never derived.** BC and velocity are exactly what the
 *   manufacturer's own product page publishes, G1 and G7 as published. No
 *   conversion between drag models and no averaging across sources.
 * - **Cited.** `sourcePage` is the product page the figures were read from and
 *   `accessed` the date they were read. The page is stored without its scheme
 *   because this app makes no network requests and keeps no remote URL in
 *   `src/` (see `offlineFirst.test.ts`); it is a citation, not a link. The full
 *   addresses are in `docs/user/rifle-and-ammo-setup.md`.
 * - **A caliber the app offers.** `caliber` is a `CALIBERS` value, so a
 *   pre-filled profile gets a bullet diameter for spin drift.
 *
 * Published velocity comes from the manufacturer's test barrel
 * (`testBarrelInches`), not the shooter's rifle. That is why the form still
 * says to chronograph, and why the pre-filled note records the barrel length
 * when the page gives one.
 *
 * Adding a load: read the figures off the manufacturer's current product page,
 * add the entry with today's date, and add the page to the user docs table.
 * Do not add a load whose page no longer lists it.
 */

/** One factory load, as its manufacturer publishes it. */
export interface FactoryLoad {
  /** Stable key for the picker. */
  id: string;
  /** One of `AMMO_MANUFACTURERS`. */
  manufacturer: string;
  /** The product name as printed on the box. */
  name: string;
  /** A `CALIBERS` value. */
  caliber: string;
  /** Bullet weight in grains. */
  bulletWeight: number;
  bulletType: string;
  ballisticCoefficientG1: number;
  ballisticCoefficientG7: number;
  /** Published muzzle velocity, fps. */
  muzzleVelocity: number;
  /**
   * Barrel length the published velocity was measured in, inches, when the
   * cited page states it. Left out when it does not, rather than guessed.
   */
  testBarrelInches?: number;
  /** The manufacturer's item or part number. */
  productNumber: string;
  /** Product page the figures were read from, without the scheme. */
  sourcePage: string;
  /** ISO date the figures were read from that page. */
  accessed: string;
}

const HORNADY = 'hornady.com/ammunition/rifle/';
const BERGER = 'bergerbullets.com/product/';
const ACCESSED = '2026-11-08';
const CREEDMOOR_65 = '6.5 Creedmoor';

export const FACTORY_LOADS: readonly FactoryLoad[] = [
  {
    id: 'hornady-81500',
    manufacturer: 'Hornady',
    name: 'Hornady 6.5 Creedmoor 140 gr ELD Match',
    caliber: CREEDMOOR_65,
    bulletWeight: 140,
    bulletType: 'ELD Match',
    ballisticCoefficientG1: 0.646,
    ballisticCoefficientG7: 0.326,
    muzzleVelocity: 2710,
    testBarrelInches: 24,
    productNumber: '81500',
    sourcePage: `${HORNADY}6-5-creedmoor-140-gr-eld-match`,
    accessed: ACCESSED,
  },
  {
    id: 'hornady-81499',
    manufacturer: 'Hornady',
    name: 'Hornady 6.5 Creedmoor 143 gr ELD-X Precision Hunter',
    caliber: CREEDMOOR_65,
    bulletWeight: 143,
    bulletType: 'ELD-X',
    ballisticCoefficientG1: 0.623,
    ballisticCoefficientG7: 0.314,
    muzzleVelocity: 2700,
    testBarrelInches: 24,
    productNumber: '81499',
    sourcePage: `${HORNADY}6-5-creedmoor-143-gr-eld-x-precision-hunter`,
    accessed: ACCESSED,
  },
  {
    id: 'berger-31011',
    manufacturer: 'Berger',
    name: 'Berger 6.5 Creedmoor 140 gr Hybrid Target',
    caliber: CREEDMOOR_65,
    bulletWeight: 140,
    bulletType: 'Hybrid Target',
    ballisticCoefficientG1: 0.607,
    ballisticCoefficientG7: 0.311,
    muzzleVelocity: 2750,
    productNumber: '31011',
    sourcePage: `${BERGER}6-5-mm-creedmoor-140gr-hybrid-target`,
    accessed: ACCESSED,
  },
  {
    id: 'berger-31081',
    manufacturer: 'Berger',
    name: 'Berger 6.5 Creedmoor 144 gr Long Range Hybrid Target',
    caliber: CREEDMOOR_65,
    bulletWeight: 144,
    bulletType: 'Long Range Hybrid Target',
    ballisticCoefficientG1: 0.655,
    ballisticCoefficientG7: 0.336,
    muzzleVelocity: 2830,
    productNumber: '31081',
    sourcePage: `${BERGER}6-5-mm-creedmoor-144gr-long-range-hybrid-target`,
    accessed: ACCESSED,
  },
  {
    id: 'hornady-80966',
    manufacturer: 'Hornady',
    name: 'Hornady 308 Win 168 gr ELD Match',
    caliber: '.308 Winchester',
    bulletWeight: 168,
    bulletType: 'ELD Match',
    ballisticCoefficientG1: 0.523,
    ballisticCoefficientG7: 0.263,
    muzzleVelocity: 2700,
    testBarrelInches: 24,
    productNumber: '80966',
    sourcePage: `${HORNADY}308-win-168-gr-eld-match`,
    accessed: ACCESSED,
  },
  {
    id: 'hornady-80994',
    manufacturer: 'Hornady',
    name: 'Hornady 308 Win 178 gr ELD-X Precision Hunter',
    caliber: '.308 Winchester',
    bulletWeight: 178,
    bulletType: 'ELD-X',
    ballisticCoefficientG1: 0.552,
    ballisticCoefficientG7: 0.278,
    muzzleVelocity: 2600,
    testBarrelInches: 24,
    productNumber: '80994',
    sourcePage: `${HORNADY}308-win-178-gr-eld-x-precision-hunter`,
    accessed: ACCESSED,
  },
  {
    id: 'hornady-80269',
    manufacturer: 'Hornady',
    name: 'Hornady 223 Rem 73 gr ELD Match',
    caliber: '.223 Remington',
    bulletWeight: 73,
    bulletType: 'ELD Match',
    ballisticCoefficientG1: 0.398,
    ballisticCoefficientG7: 0.2,
    muzzleVelocity: 2790,
    testBarrelInches: 24,
    productNumber: '80269',
    sourcePage: `${HORNADY}223-rem-73-gr-eld-match`,
    accessed: ACCESSED,
  },
  {
    id: 'hornady-81608',
    manufacturer: 'Hornady',
    name: 'Hornady 6mm ARC 108 gr ELD Match',
    caliber: '6mm ARC',
    bulletWeight: 108,
    bulletType: 'ELD Match',
    ballisticCoefficientG1: 0.536,
    ballisticCoefficientG7: 0.27,
    muzzleVelocity: 2750,
    testBarrelInches: 24,
    productNumber: '81608',
    sourcePage: `${HORNADY}6mm-arc-108-gr-eld-match`,
    accessed: ACCESSED,
  },
  {
    id: 'hornady-80536',
    manufacturer: 'Hornady',
    name: 'Hornady 270 Win 145 gr ELD-X Precision Hunter',
    caliber: '.270 Win',
    bulletWeight: 145,
    bulletType: 'ELD-X',
    ballisticCoefficientG1: 0.536,
    ballisticCoefficientG7: 0.27,
    muzzleVelocity: 2970,
    testBarrelInches: 24,
    productNumber: '80536',
    sourcePage: `${HORNADY}270-win-145-gr-eld-x-precision-hunter`,
    accessed: ACCESSED,
  },
  {
    id: 'hornady-81174',
    manufacturer: 'Hornady',
    name: 'Hornady 30-06 Springfield 178 gr ELD-X Precision Hunter',
    caliber: '.30-06',
    bulletWeight: 178,
    bulletType: 'ELD-X',
    ballisticCoefficientG1: 0.552,
    ballisticCoefficientG7: 0.278,
    muzzleVelocity: 2750,
    testBarrelInches: 24,
    productNumber: '81174',
    sourcePage: `${HORNADY}30-06-springfield-178-gr-eld-x-precision-hunter`,
    accessed: ACCESSED,
  },
  {
    id: 'hornady-82180',
    manufacturer: 'Hornady',
    name: 'Hornady 300 Win Mag 195 gr ELD Match',
    caliber: '.300 Win Mag',
    bulletWeight: 195,
    bulletType: 'ELD Match',
    ballisticCoefficientG1: 0.584,
    ballisticCoefficientG7: 0.292,
    muzzleVelocity: 2930,
    testBarrelInches: 24,
    productNumber: '82180',
    sourcePage: `${HORNADY}300-win-mag-195-gr-eld-match`,
    accessed: ACCESSED,
  },
  {
    id: 'hornady-80711',
    manufacturer: 'Hornady',
    name: 'Hornady 7mm PRC 180 gr ELD Match',
    caliber: '7mm PRC',
    bulletWeight: 180,
    bulletType: 'ELD Match',
    ballisticCoefficientG1: 0.796,
    ballisticCoefficientG7: 0.401,
    muzzleVelocity: 2975,
    testBarrelInches: 24,
    productNumber: '80711',
    sourcePage: `${HORNADY}7mm-prc-180-gr-eld-match`,
    accessed: ACCESSED,
  },
];

/**
 * The loads to offer for a caliber: that caliber's loads when it has any,
 * otherwise every load, so a caliber with no factory entry still shows the
 * shooter what exists rather than an empty list.
 */
export const factoryLoadsFor = (caliber: string | undefined): readonly FactoryLoad[] => {
  const matching = FACTORY_LOADS.filter((load) => load.caliber === caliber);
  return matching.length > 0 ? matching : FACTORY_LOADS;
};

/** Looks a load up by its picker key. */
export const factoryLoadById = (id: string): FactoryLoad | undefined =>
  FACTORY_LOADS.find((load) => load.id === id);

/**
 * The note a pre-filled profile starts with: where the figures came from and
 * the barrel they describe, so a profile saved without a chronograph says so.
 */
export const factoryLoadNote = (load: FactoryLoad): string =>
  `Factory figures: ${load.manufacturer} #${load.productNumber}, ` +
  `${load.muzzleVelocity} fps ` +
  (load.testBarrelInches === undefined
    ? '(the page does not give the test barrel length). '
    : `from a ${load.testBarrelInches} in. test barrel. `) +
  `Source: ${load.sourcePage} (read ${load.accessed}).`;
