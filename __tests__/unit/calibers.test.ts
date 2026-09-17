import fs from 'fs';
import path from 'path';

import { CALIBERS, CALIBER_OPTIONS, caliberDiameter } from '../../src/constants/calibers';
import { getBulletDiameter } from '../../src/utils/spinDrift';

/**
 * The caliber database is the single source of truth (#67).
 *
 * It exists because there were three lists and no two agreed. The tests that
 * matter here are not "the table has entries" -- they are the ones that fail
 * when the lists start drifting apart again, which is how the original bug
 * arrived.
 */

const screensDir = path.resolve(__dirname, '../../src/screens');

describe('the database itself', () => {
  it('has an entry for every caliber the picker offers', () => {
    expect(CALIBER_OPTIONS).toHaveLength(CALIBERS.length);
    expect(CALIBERS.length).toBeGreaterThan(30);
  });

  it('gives every caliber a plausible bullet diameter', () => {
    // .17 rimfire at one end, .45-70 at the other. A value outside this is not a
    // rifle bullet, and the point of the table is that nothing is estimated.
    const offenders = CALIBERS.filter((c) => !(c.diameter >= 0.17 && c.diameter <= 0.46));

    expect(offenders.map((c) => `${c.value}=${c.diameter}`)).toEqual([]);
  });

  it('has no duplicate values, so the lookup is unambiguous', () => {
    const values = CALIBERS.map((c) => c.value.toLowerCase());

    expect(values.filter((v, i) => values.indexOf(v) !== i)).toEqual([]);
  });
});

describe('no screen keeps its own caliber list', () => {
  it('is how the lists drifted apart, so it is asserted rather than remembered', () => {
    // Both profile forms used to carry character-for-character copies of the
    // same array. Nothing stopped one from being edited.
    const offenders = fs
      .readdirSync(screensDir)
      .filter((f) => /\.tsx$/.test(f))
      .filter((f) =>
        /const\s+CALIBER_OPTIONS\s*=/.test(fs.readFileSync(path.join(screensDir, f), 'utf8'))
      );

    expect(offenders).toEqual([]);
  });

  it('and both forms import the shared one', () => {
    for (const form of ['RifleProfileForm.tsx', 'AmmoProfileForm.tsx']) {
      const source = fs.readFileSync(path.join(screensDir, form), 'utf8');
      expect(source).toMatch(
        /import\s*\{[^}]*CALIBER_OPTIONS[^}]*\}\s*from\s*'\.\.\/constants\/calibers'/
      );
    }
  });
});

describe('the two sources of diameter agree', () => {
  /**
   * The test that can actually catch a wrong number.
   *
   * Asserting `getBulletDiameter(c.value) === c.diameter` for every entry proves
   * the solver reads the table -- worth proving -- but it compares the table
   * against itself, so it would pass just as happily with `7.92x57mm` typed as
   * 0.223. The plausible-range check would not catch that either: 0.223 is a
   * perfectly plausible rifle bullet.
   *
   * `CALIBER_DIAMETER_MAP` in spinDrift.ts is an independent source for the same
   * quantity, written at a different time. Where the two name the same
   * cartridge they must agree, and a typo in either one breaks that. It is the
   * only cross-check available without leaving the repository.
   */

  const spinDriftSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/utils/spinDrift.ts'),
    'utf8'
  );

  /** `CALIBER_DIAMETER_MAP`, read from source rather than exported for this. */
  const legacyMap = (): Record<string, number> => {
    const start = spinDriftSource.indexOf('CALIBER_DIAMETER_MAP');
    const block = spinDriftSource.slice(start, spinDriftSource.indexOf('\n};', start));
    return Object.fromEntries(
      [...block.matchAll(/'([^']+)':\s*([\d.]+)/g)].map((m) => [m[1], Number(m[2])])
    );
  };

  /** Names compared ignoring spacing and case: `.22LR` and `.22 LR` are one cartridge. */
  const normalise = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '');

  it('finds both sources, so a broken parse cannot pass vacuously', () => {
    expect(Object.keys(legacyMap()).length).toBeGreaterThan(40);
    expect(CALIBERS.length).toBeGreaterThan(30);
  });

  it('assigns the same diameter to every cartridge both of them name', () => {
    const legacy = new Map(
      Object.entries(legacyMap()).map(([name, diameter]) => [normalise(name), { name, diameter }])
    );

    const conflicts = CALIBERS.flatMap((caliber) => {
      const match = legacy.get(normalise(caliber.value));
      if (match === undefined) return [];
      if (Math.abs(match.diameter - caliber.diameter) < 1e-9) return [];
      return [`${caliber.value}=${caliber.diameter} vs ${match.name}=${match.diameter}`];
    });

    expect(conflicts).toEqual([]);
  });

  it('overlaps enough for the comparison to mean something', () => {
    // If the two lists stopped sharing any names, the test above would pass by
    // comparing nothing at all.
    const legacy = new Set(Object.keys(legacyMap()).map(normalise));
    const shared = CALIBERS.filter((c) => legacy.has(normalise(c.value)));

    expect(shared.length).toBeGreaterThanOrEqual(15);
  });
});

describe('caliberDiameter', () => {
  it('resolves a caliber the app offers', () => {
    expect(caliberDiameter('.308 Winchester')).toBe(0.308);
    expect(caliberDiameter('6.5 Creedmoor')).toBe(0.264);
  });

  it('is case- and whitespace-insensitive, because stored values outlive the list', () => {
    expect(caliberDiameter('  .308 WINCHESTER ')).toBe(0.308);
  });

  it('returns undefined rather than a guess for anything it does not know', () => {
    // A plausible-looking wrong number is worse than a gap: nothing downstream
    // can tell it apart from a real measurement.
    expect(caliberDiameter('.338 Lapua Magnum')).toBeUndefined();
    expect(caliberDiameter('')).toBeUndefined();
    expect(caliberDiameter(undefined)).toBeUndefined();
    expect(caliberDiameter(null)).toBeUndefined();
  });
});

describe('the solver sees the database, not the estimator', () => {
  /**
   * The regression this whole change exists for. `getBulletDiameter` falls back
   * to pulling digits out of the caliber name, which read 0.45" out of
   * `5.45x39mm` and 0.92" out of `7.92x57mm`. Spin drift scales with diameter,
   * so that is a windage correction computed for a bullet three times too fat --
   * presented to the shooter with nothing marking it as estimated.
   */

  it.each(CALIBERS.map((c) => [c.value, c.diameter]))(
    'resolves %s to its tabulated diameter',
    (value, diameter) => {
      expect(getBulletDiameter(value as string)).toBe(diameter);
    }
  );

  it('specifically no longer mis-reads the metric designations', () => {
    // Named explicitly. The parameterised test above would pass if someone
    // "fixed" the table to match whatever the estimator returns.
    expect(getBulletDiameter('5.45x39mm')).toBeCloseTo(0.22, 3);
    expect(getBulletDiameter('7.92x57mm')).toBeCloseTo(0.323, 3);
    expect(getBulletDiameter('.30-30 Win')).toBeCloseTo(0.308, 3);
    expect(getBulletDiameter('.22LR')).toBeCloseTo(0.224, 3);
  });

  it('still answers for calibers outside the picker, so imports keep working', () => {
    // The estimator is not removed -- an imported profile may carry a caliber
    // this version of the list has never heard of, and a rough diameter beats
    // no spin drift at all there. It is just no longer on the path any
    // selectable caliber takes.
    expect(getBulletDiameter('.338 Lapua')).toBeGreaterThan(0);
  });
});
