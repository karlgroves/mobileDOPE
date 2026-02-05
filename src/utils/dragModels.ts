/**
 * Ballistic drag models (G1 and G7)
 * Based on standard drag functions used in external ballistics
 */

/**
 * G1 Drag Function Table
 * Standard drag function for flat-base bullets
 * Mach numbers and corresponding drag coefficients
 */
const G1_DRAG_TABLE: [number, number][] = [
  [0.0, 0.2629],
  [0.05, 0.2558],
  [0.1, 0.2487],
  [0.15, 0.2413],
  [0.2, 0.2344],
  [0.25, 0.2278],
  [0.3, 0.2214],
  [0.35, 0.2155],
  [0.4, 0.2104],
  [0.45, 0.2061],
  [0.5, 0.2032],
  [0.55, 0.202],
  [0.6, 0.2034],
  [0.7, 0.2165],
  [0.725, 0.223],
  [0.75, 0.2313],
  [0.775, 0.2417],
  [0.8, 0.2546],
  [0.825, 0.2706],
  [0.85, 0.2901],
  [0.875, 0.3136],
  [0.9, 0.3415],
  [0.925, 0.3734],
  [0.95, 0.4084],
  [0.975, 0.4448],
  [1.0, 0.4805],
  [1.025, 0.5136],
  [1.05, 0.5427],
  [1.075, 0.5677],
  [1.1, 0.5883],
  [1.125, 0.6053],
  [1.15, 0.6191],
  [1.2, 0.6393],
  [1.25, 0.6518],
  [1.3, 0.6589],
  [1.35, 0.6621],
  [1.4, 0.6625],
  [1.45, 0.6607],
  [1.5, 0.6573],
  [1.55, 0.6528],
  [1.6, 0.6474],
  [1.65, 0.6413],
  [1.7, 0.6347],
  [1.75, 0.628],
  [1.8, 0.621],
  [1.85, 0.6141],
  [1.9, 0.6072],
  [1.95, 0.6003],
  [2.0, 0.5934],
  [2.05, 0.5867],
  [2.1, 0.5804],
  [2.15, 0.5743],
  [2.2, 0.5685],
  [2.25, 0.563],
  [2.3, 0.5577],
  [2.35, 0.5527],
  [2.4, 0.5481],
  [2.45, 0.5438],
  [2.5, 0.5397],
  [2.6, 0.5325],
  [2.7, 0.5264],
  [2.8, 0.5211],
  [2.9, 0.5168],
  [3.0, 0.5133],
  [3.1, 0.5105],
  [3.2, 0.5084],
  [3.3, 0.5067],
  [3.4, 0.5054],
  [3.5, 0.504],
  [3.6, 0.503],
  [3.7, 0.5022],
  [3.8, 0.5016],
  [3.9, 0.501],
  [4.0, 0.5006],
  [4.2, 0.4998],
  [4.4, 0.4995],
  [4.6, 0.4992],
  [4.8, 0.499],
  [5.0, 0.4988],
];

/**
 * G7 Drag Function Table
 * Drag function for long, boat-tail bullets
 * Mach numbers and corresponding drag coefficients
 */
const G7_DRAG_TABLE: [number, number][] = [
  [0.0, 0.1198],
  [0.05, 0.1197],
  [0.1, 0.1196],
  [0.15, 0.1194],
  [0.2, 0.1193],
  [0.25, 0.1194],
  [0.3, 0.1194],
  [0.35, 0.1194],
  [0.4, 0.1193],
  [0.45, 0.1193],
  [0.5, 0.1194],
  [0.55, 0.1193],
  [0.6, 0.1194],
  [0.65, 0.1197],
  [0.7, 0.1202],
  [0.75, 0.1207],
  [0.8, 0.1215],
  [0.85, 0.1226],
  [0.875, 0.123],
  [0.9, 0.1255],
  [0.925, 0.1265],
  [0.95, 0.129],
  [0.975, 0.1313],
  [1.0, 0.1338],
  [1.025, 0.1368],
  [1.05, 0.1398],
  [1.075, 0.1428],
  [1.1, 0.1459],
  [1.125, 0.1489],
  [1.15, 0.152],
  [1.2, 0.1578],
  [1.25, 0.1629],
  [1.3, 0.1674],
  [1.35, 0.1714],
  [1.4, 0.175],
  [1.45, 0.1783],
  [1.5, 0.1813],
  [1.55, 0.1841],
  [1.6, 0.1867],
  [1.65, 0.1891],
  [1.7, 0.1913],
  [1.75, 0.1934],
  [1.8, 0.1953],
  [1.85, 0.1971],
  [1.9, 0.1987],
  [1.95, 0.2002],
  [2.0, 0.2016],
  [2.05, 0.2029],
  [2.1, 0.2041],
  [2.15, 0.2052],
  [2.2, 0.2062],
  [2.25, 0.2072],
  [2.3, 0.208],
  [2.35, 0.2088],
  [2.4, 0.2095],
  [2.45, 0.2102],
  [2.5, 0.2109],
  [2.6, 0.2121],
  [2.7, 0.2132],
  [2.8, 0.2142],
  [2.9, 0.2151],
  [3.0, 0.2159],
  [3.1, 0.2166],
  [3.2, 0.2173],
  [3.3, 0.2179],
  [3.4, 0.2185],
  [3.5, 0.2191],
  [3.6, 0.2196],
  [3.7, 0.22],
  [3.8, 0.2205],
  [3.9, 0.2209],
  [4.0, 0.2213],
  [4.2, 0.2219],
  [4.4, 0.2224],
  [4.6, 0.2229],
  [4.8, 0.2233],
  [5.0, 0.2238],
];

/**
 * Linear interpolation helper
 */
function interpolate(x: number, x1: number, y1: number, x2: number, y2: number): number {
  return y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
}

/**
 * Get drag coefficient from table using linear interpolation
 */
function getDragFromTable(mach: number, table: [number, number][]): number {
  // Handle out of bounds
  if (mach <= table[0][0]) {
    return table[0][1];
  }
  if (mach >= table[table.length - 1][0]) {
    return table[table.length - 1][1];
  }

  // Find bracketing values
  for (let i = 0; i < table.length - 1; i++) {
    const [mach1, cd1] = table[i];
    const [mach2, cd2] = table[i + 1];

    if (mach >= mach1 && mach <= mach2) {
      return interpolate(mach, mach1, cd1, mach2, cd2);
    }
  }

  // Fallback (should never reach here)
  return table[table.length - 1][1];
}

/**
 * Get G1 drag coefficient for a given velocity
 * @param velocity - Velocity in feet per second
 * @param speedOfSound - Speed of sound in fps (default 1116 fps at 59°F)
 * @returns Drag coefficient
 */
export function getG1DragCoefficient(velocity: number, speedOfSound: number = 1116): number {
  const mach = velocity / speedOfSound;
  return getDragFromTable(mach, G1_DRAG_TABLE);
}

/**
 * Get G7 drag coefficient for a given velocity
 * @param velocity - Velocity in feet per second
 * @param speedOfSound - Speed of sound in fps (default 1116 fps at 59°F)
 * @returns Drag coefficient
 */
export function getG7DragCoefficient(velocity: number, speedOfSound: number = 1116): number {
  const mach = velocity / speedOfSound;
  return getDragFromTable(mach, G7_DRAG_TABLE);
}

/**
 * Drag model type
 */
export type DragModel = 'G1' | 'G7';

/**
 * Get drag coefficient for a given velocity and drag model
 * @param velocity - Velocity in feet per second
 * @param model - Drag model ('G1' or 'G7')
 * @param speedOfSound - Speed of sound in fps
 * @returns Drag coefficient
 */
export function getDragCoefficient(
  velocity: number,
  model: DragModel,
  speedOfSound: number = 1116
): number {
  return model === 'G1'
    ? getG1DragCoefficient(velocity, speedOfSound)
    : getG7DragCoefficient(velocity, speedOfSound);
}

/**
 * Flight regime boundaries for drag modeling
 */
export const MACH_SUBSONIC = 0.8; // Below this is fully subsonic
export const MACH_TRANSONIC_LOW = 0.8; // Transonic zone lower bound
export const MACH_TRANSONIC_HIGH = 1.2; // Transonic zone upper bound
export const MACH_SUPERSONIC = 1.2; // Above this is fully supersonic

/**
 * Flight regime type
 */
export type FlightRegime = 'subsonic' | 'transonic' | 'supersonic';

/**
 * Determine flight regime based on Mach number
 */
export function getFlightRegime(mach: number): FlightRegime {
  if (mach < MACH_TRANSONIC_LOW) return 'subsonic';
  if (mach > MACH_TRANSONIC_HIGH) return 'supersonic';
  return 'transonic';
}

/**
 * Get the rate of change of drag coefficient (dCd/dM)
 * This indicates how rapidly drag is changing with velocity
 * High values indicate the transonic instability zone
 *
 * @param velocity - Velocity in fps
 * @param model - Drag model
 * @param speedOfSound - Speed of sound in fps
 * @returns Rate of change of Cd per Mach 0.01
 */
export function getDragChangeRate(
  velocity: number,
  model: DragModel,
  speedOfSound: number = 1116
): number {
  const delta = 0.01; // Small Mach increment
  const machDelta = delta * speedOfSound;

  const cdLow = getDragCoefficient(velocity - machDelta / 2, model, speedOfSound);
  const cdHigh = getDragCoefficient(velocity + machDelta / 2, model, speedOfSound);

  return (cdHigh - cdLow) / delta;
}

/**
 * Subsonic BC adjustment factor
 *
 * BC values are typically measured at supersonic velocities.
 * When a bullet goes subsonic, the effective BC changes because
 * the drag characteristics are different.
 *
 * This provides an adjustment factor to apply to the published BC
 * for more accurate subsonic trajectory calculation.
 *
 * @param mach - Current Mach number
 * @param model - Drag model ('G1' or 'G7')
 * @returns BC adjustment factor (multiply published BC by this)
 */
export function getSubsonicBCAdjustment(mach: number, model: DragModel): number {
  // Reference Mach for BC measurement (typically around Mach 2.0-2.5)
  const referenceMach = 2.0;

  // Get drag coefficients at reference and current Mach
  const cdReference = getDragFromTable(
    referenceMach,
    model === 'G1' ? G1_DRAG_TABLE : G7_DRAG_TABLE
  );
  const cdCurrent = getDragFromTable(mach, model === 'G1' ? G1_DRAG_TABLE : G7_DRAG_TABLE);

  // BC is inversely proportional to Cd, so adjustment = Cd_ref / Cd_current
  // If current Cd is higher (subsonic), BC is effectively lower
  if (cdCurrent <= 0) return 1.0;

  return cdReference / cdCurrent;
}

/**
 * Get effective BC at current velocity
 *
 * @param publishedBC - BC as published (measured at supersonic velocity)
 * @param velocity - Current velocity in fps
 * @param model - Drag model
 * @param speedOfSound - Speed of sound in fps
 * @returns Effective BC at current velocity
 */
export function getEffectiveBC(
  publishedBC: number,
  velocity: number,
  model: DragModel,
  speedOfSound: number = 1116
): number {
  const mach = velocity / speedOfSound;
  const adjustment = getSubsonicBCAdjustment(mach, model);
  return publishedBC * adjustment;
}

/**
 * Drag analysis result for a given velocity
 */
export interface DragAnalysis {
  /** Current Mach number */
  mach: number;
  /** Flight regime */
  regime: FlightRegime;
  /** Drag coefficient */
  cd: number;
  /** Rate of change of Cd per Mach 0.01 */
  cdChangeRate: number;
  /** BC adjustment factor for subsonic flight */
  bcAdjustment: number;
  /** Whether bullet is in unstable transonic zone */
  isUnstable: boolean;
  /** Description of current drag characteristics */
  description: string;
}

/**
 * Analyze drag characteristics at a given velocity
 *
 * @param velocity - Velocity in fps
 * @param model - Drag model
 * @param speedOfSound - Speed of sound in fps
 * @returns Comprehensive drag analysis
 */
export function analyzeDrag(
  velocity: number,
  model: DragModel,
  speedOfSound: number = 1116
): DragAnalysis {
  const mach = velocity / speedOfSound;
  const regime = getFlightRegime(mach);
  const cd = getDragCoefficient(velocity, model, speedOfSound);
  const cdChangeRate = getDragChangeRate(velocity, model, speedOfSound);
  const bcAdjustment = getSubsonicBCAdjustment(mach, model);

  // The bullet is considered unstable when drag is changing rapidly
  // This typically occurs in the transonic zone (Mach 0.9-1.1)
  const isUnstable = Math.abs(cdChangeRate) > 0.05;

  let description: string;
  if (regime === 'supersonic') {
    description = `Supersonic flight (Mach ${mach.toFixed(2)}). Drag is stable and predictable.`;
  } else if (regime === 'subsonic') {
    description = `Subsonic flight (Mach ${mach.toFixed(2)}). BC effectiveness reduced to ${(bcAdjustment * 100).toFixed(0)}% of published value.`;
  } else {
    if (isUnstable) {
      description = `Transonic zone (Mach ${mach.toFixed(2)}). Drag is changing rapidly - accuracy may be degraded.`;
    } else {
      description = `Transonic zone (Mach ${mach.toFixed(2)}). Bullet transitioning between flight regimes.`;
    }
  }

  return {
    mach,
    regime,
    cd,
    cdChangeRate,
    bcAdjustment,
    isUnstable,
    description,
  };
}

/**
 * Get drag coefficient ratio between two Mach numbers
 * Useful for understanding how much drag increases/decreases
 *
 * @param machFrom - Starting Mach number
 * @param machTo - Ending Mach number
 * @param model - Drag model
 * @returns Ratio of drag coefficients (Cd_to / Cd_from)
 */
export function getDragRatio(machFrom: number, machTo: number, model: DragModel): number {
  const table = model === 'G1' ? G1_DRAG_TABLE : G7_DRAG_TABLE;
  const cdFrom = getDragFromTable(machFrom, table);
  const cdTo = getDragFromTable(machTo, table);

  if (cdFrom <= 0) return 1.0;
  return cdTo / cdFrom;
}

/**
 * Find the Mach number where drag coefficient is maximum
 * This is typically in the transonic zone
 *
 * @param model - Drag model
 * @returns Mach number of maximum drag
 */
export function getMaxDragMach(model: DragModel): { mach: number; cd: number } {
  const table = model === 'G1' ? G1_DRAG_TABLE : G7_DRAG_TABLE;

  let maxCd = 0;
  let maxMach = 0;

  for (const [mach, cd] of table) {
    if (cd > maxCd) {
      maxCd = cd;
      maxMach = mach;
    }
  }

  return { mach: maxMach, cd: maxCd };
}
