/**
 * Ballistic drag models (G1 and G7)
 * Based on standard drag functions used in external ballistics
 */

/**
 * G1 Drag Function Table
 * Standard drag function for flat-base bullets
 * Mach numbers and corresponding drag coefficients
 */
const G1_DRAG_TABLE: Array<[number, number]> = [
  [0.0, 0.2629],
  [0.05, 0.2558],
  [0.10, 0.2487],
  [0.15, 0.2413],
  [0.20, 0.2344],
  [0.25, 0.2278],
  [0.30, 0.2214],
  [0.35, 0.2155],
  [0.40, 0.2104],
  [0.45, 0.2061],
  [0.50, 0.2032],
  [0.55, 0.2020],
  [0.60, 0.2034],
  [0.70, 0.2165],
  [0.725, 0.2230],
  [0.75, 0.2313],
  [0.775, 0.2417],
  [0.80, 0.2546],
  [0.825, 0.2706],
  [0.85, 0.2901],
  [0.875, 0.3136],
  [0.90, 0.3415],
  [0.925, 0.3734],
  [0.95, 0.4084],
  [0.975, 0.4448],
  [1.0, 0.4805],
  [1.025, 0.5136],
  [1.05, 0.5427],
  [1.075, 0.5677],
  [1.10, 0.5883],
  [1.125, 0.6053],
  [1.15, 0.6191],
  [1.20, 0.6393],
  [1.25, 0.6518],
  [1.30, 0.6589],
  [1.35, 0.6621],
  [1.40, 0.6625],
  [1.45, 0.6607],
  [1.50, 0.6573],
  [1.55, 0.6528],
  [1.60, 0.6474],
  [1.65, 0.6413],
  [1.70, 0.6347],
  [1.75, 0.6280],
  [1.80, 0.6210],
  [1.85, 0.6141],
  [1.90, 0.6072],
  [1.95, 0.6003],
  [2.0, 0.5934],
  [2.05, 0.5867],
  [2.10, 0.5804],
  [2.15, 0.5743],
  [2.20, 0.5685],
  [2.25, 0.5630],
  [2.30, 0.5577],
  [2.35, 0.5527],
  [2.40, 0.5481],
  [2.45, 0.5438],
  [2.50, 0.5397],
  [2.60, 0.5325],
  [2.70, 0.5264],
  [2.80, 0.5211],
  [2.90, 0.5168],
  [3.0, 0.5133],
  [3.10, 0.5105],
  [3.20, 0.5084],
  [3.30, 0.5067],
  [3.40, 0.5054],
  [3.50, 0.5040],
  [3.60, 0.5030],
  [3.70, 0.5022],
  [3.80, 0.5016],
  [3.90, 0.5010],
  [4.0, 0.5006],
  [4.20, 0.4998],
  [4.40, 0.4995],
  [4.60, 0.4992],
  [4.80, 0.4990],
  [5.0, 0.4988],
];

/**
 * G7 Drag Function Table
 * Drag function for long, boat-tail bullets
 * Mach numbers and corresponding drag coefficients
 */
const G7_DRAG_TABLE: Array<[number, number]> = [
  [0.0, 0.1198],
  [0.05, 0.1197],
  [0.10, 0.1196],
  [0.15, 0.1194],
  [0.20, 0.1193],
  [0.25, 0.1194],
  [0.30, 0.1194],
  [0.35, 0.1194],
  [0.40, 0.1193],
  [0.45, 0.1193],
  [0.50, 0.1194],
  [0.55, 0.1193],
  [0.60, 0.1194],
  [0.65, 0.1197],
  [0.70, 0.1202],
  [0.75, 0.1207],
  [0.80, 0.1215],
  [0.85, 0.1226],
  [0.875, 0.1230],
  [0.90, 0.1255],
  [0.925, 0.1265],
  [0.95, 0.1290],
  [0.975, 0.1313],
  [1.0, 0.1338],
  [1.025, 0.1368],
  [1.05, 0.1398],
  [1.075, 0.1428],
  [1.10, 0.1459],
  [1.125, 0.1489],
  [1.15, 0.1520],
  [1.20, 0.1578],
  [1.25, 0.1629],
  [1.30, 0.1674],
  [1.35, 0.1714],
  [1.40, 0.1750],
  [1.45, 0.1783],
  [1.50, 0.1813],
  [1.55, 0.1841],
  [1.60, 0.1867],
  [1.65, 0.1891],
  [1.70, 0.1913],
  [1.75, 0.1934],
  [1.80, 0.1953],
  [1.85, 0.1971],
  [1.90, 0.1987],
  [1.95, 0.2002],
  [2.0, 0.2016],
  [2.05, 0.2029],
  [2.10, 0.2041],
  [2.15, 0.2052],
  [2.20, 0.2062],
  [2.25, 0.2072],
  [2.30, 0.2080],
  [2.35, 0.2088],
  [2.40, 0.2095],
  [2.45, 0.2102],
  [2.50, 0.2109],
  [2.60, 0.2121],
  [2.70, 0.2132],
  [2.80, 0.2142],
  [2.90, 0.2151],
  [3.0, 0.2159],
  [3.10, 0.2166],
  [3.20, 0.2173],
  [3.30, 0.2179],
  [3.40, 0.2185],
  [3.50, 0.2191],
  [3.60, 0.2196],
  [3.70, 0.2200],
  [3.80, 0.2205],
  [3.90, 0.2209],
  [4.0, 0.2213],
  [4.20, 0.2219],
  [4.40, 0.2224],
  [4.60, 0.2229],
  [4.80, 0.2233],
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
function getDragFromTable(mach: number, table: Array<[number, number]>): number {
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
