import fs from 'fs';
import path from 'path';

import {
  APP_SCHEME,
  NOT_LINKABLE,
  PREFIXES,
  linking,
  parseRouteId,
  restoredInitialState,
} from '../../../src/navigation/linking';

/**
 * Deep linking structure (#65).
 *
 * Two things are worth testing here and they are not the same thing.
 *
 * 1. **Completeness** — every route that *could* be linked to has a path, and
 *    the ones that cannot are listed with a reason. Derived from the navigators,
 *    not from a hand-written list, for the reason `routeReachability.test.ts`
 *    gives: a hand-written list is wrong the moment someone adds a screen, and
 *    wrong in the direction that hides the omission.
 *
 * 2. **Safety** — a deep link is an input surface. Every parameter arrives from
 *    outside the app as a string, so a screen typed `{ logId: number }` can be
 *    handed `"abc"`.
 */

const navDir = path.resolve(__dirname, '../../../src/navigation');

/** Route names registered on a navigator, scoped so icon `name=` props are excluded. */
const registeredRoutes = (): Set<string> => {
  const routes = new Set<string>();
  for (const file of fs.readdirSync(navDir).filter((f) => /\.tsx$/.test(f))) {
    const source = fs.readFileSync(path.join(navDir, file), 'utf8');
    for (const match of source.matchAll(
      /<(?:Tab|Stack|Drawer)\.Screen[^>]*?\bname=["']([A-Za-z][A-Za-z0-9]*)["']/gs
    )) {
      routes.add(match[1]);
    }
  }
  return routes;
};

/** Every route name that appears anywhere in the linking config. */
const linkedRoutes = (config: unknown, found = new Set<string>()): Set<string> => {
  const screens = (config as { screens?: Record<string, unknown> })?.screens;
  if (!screens) return found;

  for (const [name, value] of Object.entries(screens)) {
    found.add(name);
    if (typeof value === 'object' && value !== null) linkedRoutes(value, found);
  }
  return found;
};

/** Every path string in the linking config. */
const allPaths = (config: unknown, found: string[] = []): string[] => {
  const screens = (config as { screens?: Record<string, unknown> })?.screens;
  if (!screens) return found;

  for (const value of Object.values(screens)) {
    if (typeof value === 'string') found.push(value);
    else if (typeof value === 'object' && value !== null) allPaths(value, found);
  }
  return found;
};

describe('completeness', () => {
  const routes = registeredRoutes();
  const linked = linkedRoutes(linking.config);

  it('finds the navigators, so a broken matcher cannot pass vacuously', () => {
    expect(routes.size).toBeGreaterThan(20);
    expect(linked.size).toBeGreaterThan(20);
  });

  it('gives every registered route either a path or a documented reason', () => {
    const unaccounted = [...routes]
      .filter((route) => !linked.has(route) && NOT_LINKABLE[route] === undefined)
      .sort();

    expect(unaccounted).toEqual([]);
  });

  it('does not list a route that no navigator registers', () => {
    // Catches the config drifting after a rename: a path pointing at a screen
    // that no longer exists resolves to nothing and fails silently at runtime.
    const bogus = [...linked].filter((route) => !routes.has(route)).sort();

    expect(bogus).toEqual([]);
  });

  it('explains every exclusion, and excludes only what it says it does', () => {
    expect(Object.keys(NOT_LINKABLE).sort()).toEqual([
      'BallisticSolutionResults',
      'RangeSessionActive',
      'RangeSessionSummary',
    ]);

    for (const reason of Object.values(NOT_LINKABLE)) {
      expect(reason.length).toBeGreaterThan(20);
    }
  });

  it('never both links and excludes the same route', () => {
    const contradictory = Object.keys(NOT_LINKABLE).filter((route) => linked.has(route));

    expect(contradictory).toEqual([]);
  });
});

describe('the paths themselves', () => {
  const paths = allPaths(linking.config);

  it('are unique, so a link resolves to one screen', () => {
    // Two screens on one path is a coin toss at runtime, and which one wins is
    // not something the config makes visible.
    const duplicates = paths.filter((p, i) => paths.indexOf(p) !== i);

    expect(duplicates).toEqual([]);
  });

  it('carry no leading slash, which React Navigation treats as a separate segment', () => {
    expect(paths.filter((p) => p.startsWith('/'))).toEqual([]);
  });

  it('use lower-case, hyphenated literal segments rather than screen names', () => {
    // Paths outlive screens. A link shared today must still resolve after the
    // screens behind it are renamed or rearranged, so the literal segments are
    // nouns rather than mirrors of whatever the component is called this month.
    // Parameter segments are exempt: they are camelCase because that is the name
    // the screen's param list uses, and the two must match.
    const offenders = paths.filter((path) =>
      path
        .split('/')
        .filter((segment) => !segment.startsWith(':'))
        .some((segment) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(segment))
    );

    expect(offenders).toEqual([]);
  });

  it('name parameters exactly as the screens do', () => {
    // A path saying `:rifleID` hands the screen a param it does not read, and
    // the one it does read is undefined -- which looks like an empty screen
    // rather than like a bug.
    const params = paths.flatMap((path) =>
      path
        .split('/')
        .filter((segment) => segment.startsWith(':'))
        .map((segment) => segment.slice(1))
    );

    expect(params.length).toBeGreaterThan(0);
    expect(params.filter((p) => !/^[a-z][a-zA-Z0-9]*$/.test(p))).toEqual([]);
    expect([...new Set(params)].sort()).toEqual(['ammoId', 'distance', 'logId', 'rifleId']);
  });

  it('name every parameter a screen requires', () => {
    // A path with no :id for a screen that needs one opens an empty screen.
    expect(paths).toContain('logs/:logId');
    expect(paths).toContain('curve/:rifleId/:ammoId');
    expect(paths).toContain('calculator/wind/:rifleId/:ammoId/:distance');
  });

  it('keeps the scheme and prefixes in step', () => {
    expect(PREFIXES).toEqual([`${APP_SCHEME}://`]);
  });
});

describe('parseRouteId', () => {
  /**
   * The safety half. These are the values a hostile or careless link supplies,
   * and every one of them reaches a database query if it is not stopped here.
   */

  it('accepts a plain positive integer', () => {
    expect(parseRouteId('7')).toBe(7);
    expect(parseRouteId(7)).toBe(7);
  });

  it('rejects what Number() would quietly accept', () => {
    // Each of these is 0 or a number under coercion, and each would become a
    // query for a row that does not exist -- or, for '', row 0.
    expect(parseRouteId('')).toBeUndefined();
    expect(parseRouteId('  ')).toBeUndefined();
    expect(parseRouteId('0x10')).toBeUndefined();
    expect(parseRouteId('1e3')).toBeUndefined();
  });

  it('rejects what parseInt() would quietly accept', () => {
    // parseInt('7abc') is 7. A link to logs/7abc must not open log 7.
    expect(parseRouteId('7abc')).toBeUndefined();
    expect(parseRouteId('7 OR 1=1')).toBeUndefined();
  });

  it('rejects surrounding whitespace rather than trimming it', () => {
    // Number(' 7 ') is 7. Accepting it would mean two different links opening
    // the same screen, which makes the path no longer the identifier.
    expect(parseRouteId(' 7')).toBeUndefined();
    expect(parseRouteId('7\n')).toBeUndefined();
  });

  it('rejects zero and negatives, which are not row ids', () => {
    expect(parseRouteId('0')).toBeUndefined();
    expect(parseRouteId('-1')).toBeUndefined();
    expect(parseRouteId(-1)).toBeUndefined();
  });

  it('rejects a value too large to be a safe integer', () => {
    expect(parseRouteId('99999999999999999999')).toBeUndefined();
    expect(parseRouteId(Number.MAX_SAFE_INTEGER + 2)).toBeUndefined();
  });

  it('rejects a path traversal attempt outright', () => {
    expect(parseRouteId('../../etc/passwd')).toBeUndefined();
    expect(parseRouteId('..')).toBeUndefined();
  });

  it('rejects non-string, non-number input', () => {
    expect(parseRouteId(undefined)).toBeUndefined();
    expect(parseRouteId(null)).toBeUndefined();
    expect(parseRouteId({})).toBeUndefined();
    expect(parseRouteId(['7'])).toBeUndefined();
    expect(parseRouteId(Number.NaN)).toBeUndefined();
  });
});

describe('restoredInitialState', () => {
  /**
   * Deep linking and state persistence fight over the same prop, and the loser
   * loses silently. This is the ordering that settles it.
   */

  const url = (value: string | null) => async () => value;
  const saved = (value: string | null) => async () => value;
  const state = JSON.stringify({ index: 0, routes: [{ name: 'MainTabs' }] });

  it('restores the persisted state when the app was not opened by a link', () => {
    return expect(restoredInitialState(url(null), saved(state))).resolves.toEqual({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  });

  it('discards the persisted state when a deep link opened the app', async () => {
    // The whole point. Returning the saved state here would take precedence over
    // the link inside NavigationContainer, and the user would land on the screen
    // they last closed rather than the one they tapped.
    await expect(
      restoredInitialState(url('mobiledope://logs/7'), saved(state))
    ).resolves.toBeUndefined();
  });

  it('returns undefined when there is nothing saved', async () => {
    await expect(restoredInitialState(url(null), saved(null))).resolves.toBeUndefined();
    await expect(restoredInitialState(url(null), saved(''))).resolves.toBeUndefined();
  });

  it('treats an empty url as no url', async () => {
    await expect(restoredInitialState(url(''), saved(state))).resolves.toEqual({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  });

  it('discards persisted state that is not a state object', async () => {
    // It has outlived however many app versions. A string or an array reaching
    // NavigationContainer is a crash at launch that the user cannot get out of,
    // because the bad value is reloaded on every subsequent launch too.
    await expect(
      restoredInitialState(url(null), saved('"just a string"'))
    ).resolves.toBeUndefined();
    await expect(restoredInitialState(url(null), saved('[1,2,3]'))).resolves.toBeUndefined();
    await expect(restoredInitialState(url(null), saved('null'))).resolves.toBeUndefined();
    await expect(
      restoredInitialState(url(null), saved('not json at all'))
    ).resolves.toBeUndefined();
  });

  it('survives storage or linking throwing', async () => {
    const boom = async (): Promise<string | null> => {
      throw new Error('unavailable');
    };

    // A linking failure must not cost the restore...
    await expect(restoredInitialState(boom, saved(state))).resolves.toEqual({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
    // ...and a storage failure must not take the launch down.
    await expect(restoredInitialState(url(null), boom)).resolves.toBeUndefined();
  });
});
