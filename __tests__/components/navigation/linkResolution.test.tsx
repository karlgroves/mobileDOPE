import { getStateFromPath } from '@react-navigation/native';

import { linking } from '../../../src/navigation/linking';

/**
 * What a link actually resolves to, through React Navigation's own matcher (#65).
 *
 * The config tests next door check the config's shape. This checks the thing
 * that matters: given a URL, which screen opens and what does it receive. It
 * lives under the `components` project because `@react-navigation/native` ships
 * ESM that only the jest-expo preset transforms.
 *
 * It caught a real defect. Before the linking config parsed its ids, every one
 * of these arrived as a string -- `{ logId: "7" }` into a screen that does
 * `dopeLogs.find((d) => d.id === logId)`. `7 === "7"` is false, so a link to a
 * log that plainly exists opened an empty screen, silently.
 */

/** The deepest route a path resolves to, with the params it carries. */
const resolve = (path: string): { screen: string; params: unknown } => {
  let state = getStateFromPath(path, linking.config) as
    | { routes?: { name: string; state?: unknown; params?: unknown }[]; index?: number }
    | undefined;

  if (!state) return { screen: 'NO MATCH', params: undefined };

  let screen = '?';
  let params: unknown;
  while (state?.routes?.length) {
    const route = state.routes[state.index ?? state.routes.length - 1];
    screen = route.name;
    if (route.params) params = route.params;
    state = route.state as typeof state;
  }
  return { screen, params };
};

describe('a link opens the screen it names', () => {
  it.each([
    ['logs', 'DOPELogList'],
    ['logs/7', 'DOPELogDetail'],
    ['logs/7/edit', 'DOPELogEdit'],
    ['rifles/7', 'RifleProfileDetail'],
    ['rifles/7/loads', 'AmmoProfileList'],
    ['loads/7', 'AmmoProfileDetail'],
    ['loads/7/chronograph', 'ChronographInput'],
    ['curve/1/2', 'DOPECurve'],
    ['calculator/wind/1/2/600', 'WindTable'],
    ['settings', 'Settings'],
    ['privacy', 'PrivacyPolicy'],
    ['home', 'Dashboard'],
  ])('%s opens %s', (path, screen) => {
    expect(resolve(path).screen).toBe(screen);
  });

  it('prefers a static segment over a parameter', () => {
    // `loads/new` and `loads/:ammoId` occupy the same URL space. If the
    // parameter won, "new" would be read as an id and the create screen would
    // be unreachable by link.
    expect(resolve('loads/new').screen).toBe('AmmoProfileForm');
    expect(resolve('loads/compare').screen).toBe('AmmoCompare');
    expect(resolve('rifles/new').screen).toBe('RifleProfileForm');
  });

  it('matches nothing rather than something wrong for an unknown path', () => {
    expect(resolve('nope/nope').screen).toBe('NO MATCH');
  });
});

describe('ids arrive as numbers, not as the strings the URL carried', () => {
  it.each([
    ['logs/7', { logId: 7 }],
    ['rifles/42', { rifleId: 42 }],
    ['loads/3', { ammoId: 3 }],
    ['curve/1/2', { rifleId: 1, ammoId: 2 }],
    ['calculator/wind/1/2/600', { rifleId: 1, ammoId: 2, distance: 600 }],
  ])('%s', (path, expected) => {
    expect(resolve(path).params).toEqual(expected);
  });

  it('is a number, not a numeric string', () => {
    // toEqual would not tell these apart if the expectation were written '7'.
    const params = resolve('logs/7').params as { logId: unknown };

    expect(typeof params.logId).toBe('number');
  });
});

describe('a hostile link drops the parameter rather than resolving it', () => {
  it.each(['logs/7abc', 'logs/0', 'logs/-1', 'logs/1e3', 'logs/0x10', 'logs/%20'])(
    '%s reaches the screen with no id',
    (path) => {
      // The screen then shows its not-found state, which is the correct
      // outcome. The failure this prevents is `logs/7abc` opening log 7,
      // because parseInt('7abc') is 7.
      expect(resolve(path).params).toEqual({});
    }
  );
});
