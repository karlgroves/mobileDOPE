/**
 * Deep linking structure (#65).
 *
 * Nothing links into this app today -- `app.config.ts` had no `scheme`, so a
 * `mobiledope://` URL did not resolve at all. This lays the structure down so
 * that when something needs it (a DOPE card QR code from #66, a shortcut, a
 * share sheet) the paths already exist and are already tested, rather than being
 * invented under deadline.
 *
 * ## Deep links are an input surface
 *
 * Every parameter below arrives from outside the app: another app, a QR code, a
 * web page, a scanned link on a range. React Navigation passes path segments
 * through as **strings**, so a screen expecting `{ logId: number }` receives
 * `{ logId: "7" }` -- or `{ logId: "../../etc" }` if someone is playing. Screens
 * reached this way must treat their params as untrusted and parse rather than
 * assume. `parseRouteId` is here for exactly that.
 *
 * ## What is deliberately NOT linkable
 *
 * A route is only listed when its parameters can be expressed in a URL. Two
 * cannot, and inventing a path for them would produce a link that opens a broken
 * screen:
 *
 * - `BallisticSolutionResults` takes an entire computed `BallisticSolution`
 *   object. A link could only carry the inputs, so it would have to re-solve --
 *   which is what `BallisticCalculator` is for.
 * - `RangeSessionActive` / `RangeSessionSummary` hang off live session state.
 *
 * The test asserts this exclusion list is exactly those routes, so a new screen
 * with URL-expressible params cannot be quietly forgotten.
 */

import type { LinkingOptions } from '@react-navigation/native';

/** The custom scheme registered in `app.config.ts`. */
export const APP_SCHEME = 'mobiledope';

export const PREFIXES = [`${APP_SCHEME}://`];

/**
 * Routes with no deep link, and why.
 *
 * Kept as data rather than as a comment so the test can hold the list to
 * account. An entry here is a decision; a missing entry is a bug.
 */
export const NOT_LINKABLE: Record<string, string> = {
  BallisticSolutionResults:
    'Takes a computed BallisticSolution object, which a URL cannot carry. Link to BallisticCalculator instead.',
  RangeSessionActive: 'Depends on live session state rather than on an addressable record.',
  RangeSessionSummary: 'Depends on live session state rather than on an addressable record.',
};

/**
 * Parses an id that arrived from a deep link.
 *
 * React Navigation hands path segments over as strings, so a screen typed
 * `{ logId: number }` can receive `"7"`, `"abc"`, `"1e999"` or `""`. Returning
 * undefined for anything that is not a plain positive integer keeps the garbage
 * out of a database query rather than letting `NaN` reach it.
 *
 * @param raw - The value as it arrived, of unknown type.
 */
export const parseRouteId = (raw: unknown): number | undefined => {
  if (typeof raw === 'number') {
    return Number.isSafeInteger(raw) && raw > 0 ? raw : undefined;
  }
  if (typeof raw !== 'string') return undefined;

  // Deliberately strict. `Number('')` is 0, `Number(' 7 ')` is 7 and
  // `parseInt('7abc')` is 7 -- all of which would accept input this should not.
  if (!/^[0-9]+$/.test(raw)) return undefined;

  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
};

/**
 * The path structure, mirroring the navigator nesting.
 *
 * Paths are plural nouns and stable ids, so a link shared today still resolves
 * after the screens are rearranged. They are not derived from screen names for
 * that reason: a rename should not break every link anyone has saved.
 */
export const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: PREFIXES,
  config: {
    screens: {
      MainTabs: {
        screens: {
          Dashboard: 'home',
          Session: {
            screens: {
              RangeSessionStart: 'session',
              EnvironmentInput: 'session/environment',
            },
          },
          Calculator: {
            screens: {
              BallisticCalculator: 'calculator',
              WindTable: 'calculator/wind/:rifleId/:ammoId/:distance',
              MovingTargetCalculator: 'calculator/moving-target',
            },
          },
          Rifles: {
            screens: {
              RifleProfileList: 'rifles',
              RifleProfileForm: 'rifles/new',
              RifleProfileDetail: 'rifles/:rifleId',
              AmmoProfileList: 'rifles/:rifleId/loads',
              AmmoProfileDetail: 'loads/:ammoId',
              AmmoProfileForm: 'loads/new',
              DOPECardGenerator: 'rifles/:rifleId/card/:ammoId',
              ChronographInput: 'loads/:ammoId/chronograph',
              ShotStringHistory: 'loads/:ammoId/strings',
            },
          },
          Ammo: {
            screens: {
              AllAmmoProfileList: 'loads',
              AmmoCompare: 'loads/compare',
            },
          },
          History: {
            screens: {
              DOPELogList: 'logs',
              DOPELogDetail: 'logs/:logId',
              DOPELogEdit: 'logs/:logId/edit',
              DOPECurve: 'curve/:rifleId/:ammoId',
            },
          },
        },
      },
      Settings: 'settings',
      PrivacyPolicy: 'privacy',
    },
  },
};

export default linking;

/**
 * The navigation state to restore on launch, or undefined to let the deep link decide.
 *
 * These two features fight, and the fight is silent. `NavigationContainer`
 * prefers the `initialState` prop over the state it derives from an incoming
 * URL, so an app that restores its persisted state unconditionally swallows
 * every cold-start deep link: the user taps a link to a specific log and lands
 * on whatever screen they happened to close the app on. React Navigation's own
 * state-persistence guidance says to skip the restore when a link is present,
 * and that is what this encodes.
 *
 * Injected rather than imported so the precedence can be tested without
 * mounting a navigator: the interesting behaviour is the ordering, not the
 * plumbing.
 *
 * @param getInitialUrl - Resolves the URL the app was opened with, if any.
 * @param readSavedState - Resolves the persisted state as stored, or null.
 */
export const restoredInitialState = async (
  getInitialUrl: () => Promise<string | null>,
  readSavedState: () => Promise<string | null>
): Promise<object | undefined> => {
  // A failure to read the URL must not cost the user their restored state, and
  // a failure to read the state must not cost them the deep link. Neither is
  // worth crashing the launch over.
  let initialUrl: string | null = null;
  try {
    initialUrl = await getInitialUrl();
  } catch {
    initialUrl = null;
  }

  if (initialUrl !== null && initialUrl !== '') return undefined;

  try {
    const saved = await readSavedState();
    if (saved === null || saved === '') return undefined;

    const parsed: unknown = JSON.parse(saved);
    // Anything that is not an object would make `initialState` meaningless, and
    // this value comes back from storage that has outlived however many app
    // versions. Discarding it costs one restore; passing it on is a crash at
    // launch with no way for the user to get out of it.
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;

    return parsed;
  } catch {
    return undefined;
  }
};
