import {
  MAX_LOADS,
  MISSING_CELL,
  buildComparison,
  cellFor,
  renderComparisonHtml,
} from '../../src/utils/dopeCardComparison';

import type { ComparisonLoad } from '../../src/utils/dopeCardComparison';

/**
 * The side-by-side DOPE card (#66).
 *
 * The tests that matter are about alignment. Everything else here is layout;
 * a misaligned column is a shooter dialling another load's correction off a
 * piece of paper that looks completely normal.
 */

const load = (label: string, rows: [number, number, number][]): ComparisonLoad => ({
  label,
  rows: rows.map(([distance, elevation, windage]) => ({ distance, elevation, windage })),
});

const options = {
  rifleName: 'Tikka T3x',
  angularUnit: 'MIL' as const,
  distanceUnit: 'yards' as const,
  colorMode: 'light' as const,
  generatedOn: new Date('2026-09-17T12:00:00Z'),
};

describe('the distance axis', () => {
  it('is the union of every load, not the intersection', () => {
    // Intersecting would drop 900 and 1000 entirely because one load stops at
    // 800 -- hiding data the other loads do have.
    const card = buildComparison(
      [
        load('A', [
          [100, 0, 0],
          [800, 5, 1],
        ]),
        load('B', [
          [100, 0, 0],
          [900, 6, 1],
          [1000, 7, 1],
        ]),
      ],
      options
    );

    expect(card.distances).toEqual([100, 800, 900, 1000]);
  });

  it('is sorted ascending regardless of the order rows arrive in', () => {
    const card = buildComparison(
      [
        load('A', [
          [600, 3, 1],
          [100, 0, 0],
          [300, 1, 0],
        ]),
      ],
      options
    );

    expect(card.distances).toEqual([100, 300, 600]);
  });

  it('does not repeat a distance two loads share', () => {
    const card = buildComparison([load('A', [[100, 0, 0]]), load('B', [[100, 0, 0]])], options);

    expect(card.distances).toEqual([100]);
  });

  it('ignores a non-finite distance rather than putting it on the axis', () => {
    const card = buildComparison(
      [
        load('A', [
          [100, 0, 0],
          [Number.NaN, 1, 1],
          [Number.POSITIVE_INFINITY, 2, 2],
        ]),
      ],
      options
    );

    expect(card.distances).toEqual([100]);
  });
});

describe('cell alignment', () => {
  /**
   * The failure this module exists to prevent. If a load missing a distance
   * shifted its remaining cells up, every row below would show that load's
   * correction for a *different* distance, under the right heading, with
   * nothing on the card to say so.
   */

  it('marks a distance a load does not have, rather than shifting the next one up', () => {
    const a = load('A', [
      [100, 1.0, 0.2],
      [300, 3.0, 0.6],
    ]);

    expect(cellFor(a, 100, 'MIL')).toBe('1.0 / 0.2');
    expect(cellFor(a, 200, 'MIL')).toBe(MISSING_CELL);
    expect(cellFor(a, 300, 'MIL')).toBe('3.0 / 0.6');
  });

  it('keeps every load on the same distance in the rendered row', () => {
    // The end-to-end version of the assertion above, read off the HTML: the row
    // for 300 must hold A's 300 figure and B's 300 figure, and B has no 200.
    const card = buildComparison(
      [
        load('A', [
          [100, 1.0, 0.2],
          [200, 2.0, 0.4],
          [300, 3.0, 0.6],
        ]),
        load('B', [
          [100, 1.1, 0.2],
          [300, 3.3, 0.7],
        ]),
      ],
      options
    );
    const html = renderComparisonHtml(card);

    const rowFor = (distance: number): string =>
      html.split('\n').find((line) => line.includes(`>${distance}yd<`)) ?? '';

    expect(rowFor(200)).toContain('2.0 / 0.4');
    expect(rowFor(200)).toContain(MISSING_CELL);
    expect(rowFor(300)).toContain('3.0 / 0.6');
    expect(rowFor(300)).toContain('3.3 / 0.7');
    expect(rowFor(300)).not.toContain(MISSING_CELL);
  });

  it('refuses a cell whose numbers are not finite', () => {
    // A solver that failed to converge returns NaN. `NaN.toFixed(1)` is "NaN",
    // which on paper reads as a value rather than as an absence.
    const broken: ComparisonLoad = {
      label: 'A',
      rows: [{ distance: 100, elevation: Number.NaN, windage: 0.2 }],
    };

    expect(cellFor(broken, 100, 'MIL')).toBe(MISSING_CELL);
  });

  it('uses more precision for MOA than for MIL', () => {
    // 0.1 MIL is about 0.34 MOA. One decimal of MOA throws away detail the
    // shooter's turret can actually dial.
    const a = load('A', [[100, 1.25, 0.5]]);

    expect(cellFor(a, 100, 'MIL')).toBe('1.3 / 0.5');
    expect(cellFor(a, 100, 'MOA')).toBe('1.25 / 0.50');
  });
});

describe('how many loads fit', () => {
  it('keeps the first MAX_LOADS and names the rest', () => {
    const loads = ['A', 'B', 'C', 'D', 'E', 'F'].map((l) => load(l, [[100, 1, 0]]));

    const card = buildComparison(loads, options);

    expect(card.loads).toHaveLength(MAX_LOADS);
    expect(card.omittedLoads).toEqual(['E', 'F']);
  });

  it('says on the card itself which loads were left off', () => {
    // Silently dropping them is the version of this that gets someone to the
    // range believing they printed all six.
    const loads = ['A', 'B', 'C', 'D', 'E'].map((l) => load(l, [[100, 1, 0]]));

    const html = renderComparisonHtml(buildComparison(loads, options));

    expect(html).toContain('Not shown');
    expect(html).toContain('E');
  });

  it('says nothing when everything fit', () => {
    const html = renderComparisonHtml(buildComparison([load('A', [[100, 1, 0]])], options));

    expect(html).not.toContain('Not shown');
  });
});

describe('the rendered card', () => {
  it('escapes user-entered names', () => {
    // Rifle and load names are free text, and this HTML goes to expo-print.
    const card = buildComparison([load('<script>alert(1)</script>', [[100, 1, 0]])], {
      ...options,
      rifleName: 'Tikka & "T3x"',
    });

    const html = renderComparisonHtml(card);

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Tikka &amp; &quot;T3x&quot;');
  });

  it('names the angular unit, because the numbers are meaningless without it', () => {
    const html = renderComparisonHtml(buildComparison([load('A', [[100, 1, 0]])], options));

    expect(html).toContain('MIL');
  });

  it('labels distances with the unit the card was built in', () => {
    const metric = renderComparisonHtml(
      buildComparison([load('A', [[100, 1, 0]])], { ...options, distanceUnit: 'meters' })
    );

    expect(metric).toContain('100m');
    expect(metric).not.toContain('100yd');
  });

  it('renders a header cell per load', () => {
    const card = buildComparison(
      [load('Federal 175', [[100, 1, 0]]), load('Hornady 168', [[100, 1, 0]])],
      options
    );

    const html = renderComparisonHtml(card);

    expect(html).toContain('<th>Federal 175</th>');
    expect(html).toContain('<th>Hornady 168</th>');
  });

  it('honours night vision, because a white card at the bench costs dark adaptation', () => {
    // The card exists to be read in the dark. The other two formats already do
    // this; a comparison card that came out white would undo twenty minutes of
    // the shooter's dark adaptation at the moment they need it.
    const night = renderComparisonHtml(
      buildComparison([load('A', [[100, 1, 0]])], { ...options, colorMode: 'nightVision' })
    );

    expect(night).toContain('#000000');
    expect(night).toContain('#ff0000');
    expect(night).not.toContain('#ffffff');
  });

  it('uses the light palette for daylight', () => {
    const light = renderComparisonHtml(buildComparison([load('A', [[100, 1, 0]])], options));

    expect(light).toContain('#ffffff');
    expect(light).not.toContain('#ff0000');
  });

  it('tells the print engine to keep the background', () => {
    // Browsers drop background colours when printing by default. Without this a
    // night-vision card prints as black text on white paper -- the exact
    // opposite of what was asked for, which is worse than ignoring the setting.
    const night = renderComparisonHtml(
      buildComparison([load('A', [[100, 1, 0]])], { ...options, colorMode: 'nightVision' })
    );

    expect(night).toContain('print-color-adjust: exact');
  });

  it('produces a card with no rows rather than throwing when there is nothing to compare', () => {
    const html = renderComparisonHtml(buildComparison([], options));

    expect(html).toContain('<tbody>');
    expect(html).toContain('Tikka T3x');
  });
});
