/**
 * Side-by-side DOPE card for several loads (#66).
 *
 * The existing card covers one rifle and one load. The question this answers is
 * the one a shooter actually has at the bench with three boxes of ammunition in
 * front of them: at 600 yards, what does each of these dial?
 *
 * ## Why this is a module and not more template literal in the screen
 *
 * `DOPECardGenerator` builds its HTML inline, and at 650 lines has no tests.
 * The comparison layout has one failure mode that a printed card makes
 * irreversible: if a load is missing a distance and its cells shift up, every
 * row below it shows another load's correction under this load's heading. The
 * shooter dials it. Nothing on the paper says anything is wrong.
 *
 * That is worth having tests for, and tests want a function rather than a
 * component. Solving stays in the screen, which already has the solver wiring --
 * this takes rows that have already been computed.
 */

import { escapeHtml } from './formatting';

/** One solved distance for one load. */
export interface ComparisonRow {
  distance: number;
  /** Elevation correction in the card's angular unit. */
  elevation: number;
  /** Windage correction in the card's angular unit. */
  windage: number;
  /** Remaining velocity, fps. Optional: the condensed card omits it. */
  velocity?: number;
}

/** One column of the card. */
export interface ComparisonLoad {
  /** Shown in the column heading. User-entered, so it is escaped on render. */
  label: string;
  rows: ComparisonRow[];
}

export interface ComparisonOptions {
  rifleName: string;
  angularUnit: 'MIL' | 'MOA';
  distanceUnit: 'yards' | 'meters';
  /**
   * Red on black for use at night, matching the other card formats.
   *
   * Not decoration. A white card read at the bench destroys the dark adaptation
   * the shooter has spent twenty minutes acquiring, at the moment they need it.
   *
   * Required, deliberately. The first version of this module left it out
   * entirely and the card came out white however the toggle was set; an optional
   * field with a light default would have failed the same way, silently, the
   * moment a caller forgot it. Making it required turns that into a type error.
   */
  colorMode: 'light' | 'nightVision';
  /** Defaults to today. Injected so the output is deterministic under test. */
  generatedOn?: Date;
}

/** A cell with no data, rather than an absent cell. */
export const MISSING_CELL = '--';

/**
 * The most loads one card can carry.
 *
 * A DOPE card is paper in a pocket, read in bad light with cold hands. Past
 * four loads the columns are too narrow to read at a glance, which defeats the
 * purpose of having it on paper at all. Extra loads are dropped rather than
 * silently squeezed, and `buildComparison` reports that it happened.
 */
export const MAX_LOADS = 4;

export interface ComparisonCard {
  rifleName: string;
  angularUnit: 'MIL' | 'MOA';
  distanceUnit: 'yards' | 'meters';
  colorMode: 'light' | 'nightVision';
  generatedOn: Date;
  /** The shared distance axis: every distance any load has, ascending. */
  distances: number[];
  loads: ComparisonLoad[];
  /** Labels of loads that did not fit, so the caller can say so. */
  omittedLoads: string[];
}

/**
 * Builds the card model from already-solved rows.
 *
 * The distance axis is the union of every load's distances rather than the
 * intersection. A load that stops at 800 still gets its own column, with the
 * rows past 800 marked missing -- dropping the whole row would hide the other
 * loads' data at those distances, and dropping the load entirely would hide it
 * completely. Neither is what "compare these" means.
 *
 * @param loads - One entry per load, in the order they should appear.
 * @param options - Card-level settings.
 */
export const buildComparison = (
  loads: ComparisonLoad[],
  options: ComparisonOptions
): ComparisonCard => {
  const kept = loads.slice(0, MAX_LOADS);
  const omittedLoads = loads.slice(MAX_LOADS).map((load) => load.label);

  const distances = [
    ...new Set(
      kept.flatMap((load) => load.rows.map((row) => row.distance)).filter(Number.isFinite)
    ),
  ].sort((a, b) => a - b);

  return {
    rifleName: options.rifleName,
    angularUnit: options.angularUnit,
    distanceUnit: options.distanceUnit,
    colorMode: options.colorMode,
    generatedOn: options.generatedOn ?? new Date(),
    distances,
    loads: kept,
    omittedLoads,
  };
};

/**
 * The correction cell for one load at one distance.
 *
 * Looked up by distance rather than by index. Index alignment is the bug this
 * module exists to prevent: it produces a card that looks correct and is wrong
 * by one row for every load that skipped a distance.
 */
export const cellFor = (
  load: ComparisonLoad,
  distance: number,
  angularUnit: 'MIL' | 'MOA'
): string => {
  const row = load.rows.find((candidate) => candidate.distance === distance);
  if (row === undefined) return MISSING_CELL;
  if (!Number.isFinite(row.elevation) || !Number.isFinite(row.windage)) return MISSING_CELL;

  const precision = angularUnit === 'MIL' ? 1 : 2;
  return `${row.elevation.toFixed(precision)} / ${row.windage.toFixed(precision)}`;
};

/**
 * The two print palettes, matching the detailed and condensed cards.
 *
 * Night vision is red on black because red light preserves dark adaptation;
 * the point of the card is that reading it does not cost the shooter their
 * night vision.
 */
const PALETTES = {
  light: {
    background: '#ffffff',
    text: '#000000',
    headerBg: '#e0e0e0',
    rowHeaderBg: '#f2f2f2',
    border: '#666666',
    note: '#333333',
  },
  nightVision: {
    background: '#000000',
    text: '#ff0000',
    headerBg: '#330000',
    rowHeaderBg: '#1a0000',
    border: '#660000',
    note: '#cc0000',
  },
} as const;

/** Renders the card as printable HTML. */
export const renderComparisonHtml = (card: ComparisonCard): string => {
  const distanceSuffix = card.distanceUnit === 'yards' ? 'yd' : 'm';
  const palette = PALETTES[card.colorMode];

  const headings = card.loads.map((load) => `<th>${escapeHtml(load.label)}</th>`).join('');

  const rows = card.distances
    .map((distance) => {
      const cells = card.loads
        .map((load) => `<td>${escapeHtml(cellFor(load, distance, card.angularUnit))}</td>`)
        .join('');
      return `<tr><th class="distance">${distance}${distanceSuffix}</th>${cells}</tr>`;
    })
    .join('\n      ');

  const omitted =
    card.omittedLoads.length > 0
      ? `<p class="note">Not shown (a card holds ${MAX_LOADS}): ${escapeHtml(
          card.omittedLoads.join(', ')
        )}</p>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(card.rifleName)} - load comparison</title>
    <style>
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: ${palette.text}; background: ${palette.background}; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid ${palette.border}; padding: 6px 8px; text-align: center; font-variant-numeric: tabular-nums; }
      thead th { background: ${palette.headerBg}; }
      .distance { background: ${palette.rowHeaderBg}; }
      .note { font-size: 11px; color: ${palette.note}; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(card.rifleName)}</h1>
    <p class="note">Elevation / windage in ${card.angularUnit}. Generated ${card.generatedOn.toLocaleDateString()}.</p>
    <table>
      <thead>
        <tr><th>Distance</th>${headings}</tr>
      </thead>
      <tbody>
      ${rows}
      </tbody>
    </table>
    ${omitted}
  </body>
</html>`;
};
