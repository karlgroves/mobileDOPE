import {
  ammoKey,
  describePlan,
  dopeLogKey,
  keyOn,
  planMerge,
  rifleKey,
} from '../../src/utils/importMerge';

/**
 * Import merge planning (#66).
 *
 * The behaviour that matters is what happens on the second import of the same
 * backup, and what happens to records that are nearly-but-not-quite the same.
 * Both directions are dangerous in different ways: a false match silently
 * overwrites data the user wanted, a false miss leaves a duplicate they can
 * delete. These tests pin which way each borderline case falls.
 */

type Rec = Record<string, unknown>;

const rifle = (over: Rec = {}): Rec => ({
  name: 'Tikka T3x',
  caliber: '6.5 Creedmoor',
  barrelLength: 24,
  zeroDistance: 100,
  ...over,
});

const ammo = (over: Rec = {}): Rec => ({
  name: '140 ELD-M',
  manufacturer: 'Hornady',
  bulletWeight: 140,
  muzzleVelocity: 2710,
  ...over,
});

describe('keyOn', () => {
  it('ignores case, surrounding space and repeated whitespace', () => {
    const key = keyOn('name');
    expect(key({ name: '  Tikka   T3x ' })).toBe(key({ name: 'tikka t3x' }));
  });

  it('has no key when a field is missing or blank', () => {
    const key = keyOn('name', 'caliber');
    expect(key({ name: 'Tikka' })).toBeUndefined();
    expect(key({ name: 'Tikka', caliber: '   ' })).toBeUndefined();
  });

  it('cannot be confused by field boundaries', () => {
    // ("ab","c") must not collide with ("a","bc").
    const key = keyOn('a', 'b');
    expect(key({ a: 'ab', b: 'c' })).not.toBe(key({ a: 'a', b: 'bc' }));
  });

  it('treats a non-finite number as missing rather than as a value', () => {
    const key = keyOn('velocity');
    expect(key({ velocity: Number.NaN })).toBeUndefined();
    expect(key({ velocity: Number.POSITIVE_INFINITY })).toBeUndefined();
    expect(key({ velocity: 2710 })).toBeDefined();
  });
});

describe('planMerge', () => {
  it('imports everything when nothing is stored yet', () => {
    const plan = planMerge([], [rifle(), rifle({ name: 'Bergara' })], rifleKey);

    expect(plan.created).toBe(2);
    expect(plan.skipped).toBe(0);
  });

  it('skips duplicates on a second import of the same backup', () => {
    // The defect #66 names: importing a backup twice used to double everything.
    const stored = [rifle(), rifle({ name: 'Bergara B14' })];
    const plan = planMerge(stored, [...stored], rifleKey);

    expect(plan.created).toBe(0);
    expect(plan.skipped).toBe(2);
  });

  it('replaces rather than skips under replace-existing', () => {
    const stored = [rifle({ zeroDistance: 100 })];
    const plan = planMerge(stored, [rifle({ zeroDistance: 200 })], rifleKey, 'replace-existing');

    expect(plan.replaced).toBe(1);
    expect(plan.actions[0].existing).toBe(stored[0]);
    expect(plan.actions[0].record.zeroDistance).toBe(200);
  });

  it('duplicates everything under create-all, which is the old behaviour', () => {
    const stored = [rifle()];
    const plan = planMerge(stored, [rifle()], rifleKey, 'create-all');

    expect(plan.created).toBe(1);
    expect(plan.skipped).toBe(0);
  });

  it('collapses duplicates inside one import, not just against the store', () => {
    // A backup containing the same rifle twice should not produce two rows just
    // because neither existed locally.
    const plan = planMerge([], [rifle(), rifle()], rifleKey);

    expect(plan.created).toBe(1);
    expect(plan.skipped).toBe(1);
  });

  it('imports a record with no key as new rather than guessing a match', () => {
    // Two records both missing a name are not thereby the same record.
    const plan = planMerge([rifle()], [rifle({ name: '' }), rifle({ name: '' })], rifleKey);

    expect(plan.created).toBe(2);
  });

  it('does not depend on the order stored records arrive in', () => {
    const a = rifle({ zeroDistance: 100 });
    const b = rifle({ zeroDistance: 200 }); // same natural key, local duplicate
    const forwards = planMerge([a, b], [rifle()], rifleKey, 'replace-existing');
    const backwards = planMerge([b, a], [rifle()], rifleKey, 'replace-existing');

    expect(forwards.replaced).toBe(backwards.replaced);
  });
});

describe('rifleKey', () => {
  it('matches the same rifle after an edit to something that is not its identity', () => {
    // Barrel length and zero distance are things a user legitimately changes on
    // the same rifle. Including them would re-import an edited rifle as a copy.
    const plan = planMerge(
      [rifle({ zeroDistance: 100 })],
      [rifle({ zeroDistance: 200 })],
      rifleKey
    );

    expect(plan.skipped).toBe(1);
  });

  it('keeps two rifles of the same model in different calibers apart', () => {
    const plan = planMerge([rifle()], [rifle({ caliber: '.308 Win' })], rifleKey);

    expect(plan.created).toBe(1);
  });
});

describe('ammoKey', () => {
  it('matches the same load', () => {
    expect(planMerge([ammo()], [ammo()], ammoKey).skipped).toBe(1);
  });

  it('keeps the same bullet chronographed at different velocities apart', () => {
    // A box of 140 ELD-M at 2710 from one barrel and 2750 from another is
    // genuinely different load data. Merging them would destroy the distinction
    // the user is keeping both for.
    const plan = planMerge(
      [ammo({ muzzleVelocity: 2710 })],
      [ammo({ muzzleVelocity: 2750 })],
      ammoKey
    );

    expect(plan.created).toBe(1);
  });

  it('keeps different bullet weights apart', () => {
    expect(planMerge([ammo()], [ammo({ bulletWeight: 147 })], ammoKey).created).toBe(1);
  });
});

describe('dopeLogKey', () => {
  const entry = (over: Rec = {}): Rec => ({
    rifleId: 1,
    ammoId: 2,
    distance: 600,
    timestamp: '2026-09-16T10:00:00Z',
    ...over,
  });

  it('matches the same engagement', () => {
    expect(planMerge([entry()], [entry()], dopeLogKey).skipped).toBe(1);
  });

  it('keeps the same distance on different days apart', () => {
    const plan = planMerge([entry()], [entry({ timestamp: '2026-09-17T10:00:00Z' })], dopeLogKey);

    expect(plan.created).toBe(1);
  });

  it('imports every untimestamped log rather than collapsing a session into one', () => {
    // Without a timestamp there is no key. Matching on rifle/ammo/distance alone
    // would merge every shot of a string at the same distance into one entry.
    const untimed = [
      entry({ timestamp: undefined }),
      entry({ timestamp: undefined }),
      entry({ timestamp: undefined }),
    ];

    expect(planMerge([], untimed, dopeLogKey).created).toBe(3);
  });
});

describe('describePlan', () => {
  it('reports only what happened', () => {
    const plan = planMerge([rifle()], [rifle(), rifle({ name: 'Bergara' })], rifleKey);

    const line = describePlan('Rifles', plan);
    expect(line).toContain('1 added');
    expect(line).toContain('1 already present');
    expect(line).not.toContain('replaced');
  });

  it('says so when there is nothing to do', () => {
    expect(describePlan('Rifles', planMerge([], [], rifleKey))).toContain('nothing to import');
  });
});
