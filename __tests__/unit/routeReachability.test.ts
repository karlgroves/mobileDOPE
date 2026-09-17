import fs from 'fs';
import path from 'path';

/**
 * Every registered route must be reachable (#87).
 *
 * `SettingsScreen` was registered in `RootNavigator` and `DOPECurve` in
 * `HistoryNavigator`, and nothing navigated to either. They were not broken —
 * they rendered fine, had no failing tests, and passed every gate. They simply
 * could not be opened.
 *
 * That stranded Export All Data, Import Data, Clear All Data and Delete Stored
 * Location Data, the last of which `PRIVACY.md` commits to providing. A user had
 * no way to back up a database that has no cloud copy.
 *
 * Nothing catches this by accident: a screen with no caller is invisible to the
 * type checker, the linter, Knip (it *is* imported — by the navigator) and the
 * test suite. It needs an assertion of its own.
 *
 * The check is static rather than behavioural on purpose. Driving the real
 * navigator would need every screen's data layer stood up, and would still only
 * prove the paths the test itself walked. Reading the source proves the property
 * for every route at once.
 */

const repoRoot = path.resolve(__dirname, '../..');
const navDir = path.join(repoRoot, 'src/navigation');
const srcDir = path.join(repoRoot, 'src');

/** Reads every .tsx/.ts file under a directory, recursively. */
const sourcesUnder = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourcesUnder(full);
    return /\.tsx?$/.test(entry.name) ? [fs.readFileSync(full, 'utf8')] : [];
  });

/**
 * Route names registered on a navigator.
 *
 * Matches `name="X"` only on a `<Tab.Screen>`/`<Stack.Screen>` element, so the
 * icon names that also use a `name=` prop (`home`, `bullet`, `calculator`) are
 * not mistaken for routes.
 */
const registeredRoutes = (): Set<string> => {
  const routes = new Set<string>();
  for (const source of sourcesUnder(navDir)) {
    for (const match of source.matchAll(
      /<(?:Tab|Stack|Drawer)\.Screen[^>]*?\bname=["']([A-Za-z][A-Za-z0-9]*)["']/gs
    )) {
      routes.add(match[1]);
    }
  }
  return routes;
};

/** Route names something in `src/` actually navigates to. */
const navigationTargets = (): Set<string> => {
  const targets = new Set<string>();
  for (const source of sourcesUnder(srcDir)) {
    for (const match of source.matchAll(
      /\.(?:navigate|push|replace|jumpTo)\(\s*["']([A-Za-z][A-Za-z0-9]*)["']/g
    )) {
      targets.add(match[1]);
    }
  }
  return targets;
};

/**
 * Routes reachable without anything navigating to them — derived, not listed.
 *
 * Two kinds: a tab bar entry, which the user reaches by tapping the tab, and a
 * stack's initial route, which is shown when that stack is opened. React
 * Navigation takes the initial route from `initialRouteName` when present and
 * otherwise from the first `<Stack.Screen>` in source order.
 *
 * Derived rather than hand-written because a hand-written list is wrong the
 * moment someone reorders a navigator, and wrong in the direction that hides a
 * genuinely unreachable screen. The first draft of this test listed
 * `AmmoProfileList` as the Ammo stack's initial route; it is
 * `AllAmmoProfileList`, and the mistake would have masked a real orphan.
 */
const reachableWithoutACaller = (): Set<string> => {
  const entry = new Set<string>();
  for (const file of fs.readdirSync(navDir).filter((f) => /Navigator\.tsx$/.test(f))) {
    const source = fs.readFileSync(path.join(navDir, file), 'utf8');

    const explicit = source.match(/initialRouteName=["']([A-Za-z][A-Za-z0-9]*)["']/);
    const declared = [
      ...source.matchAll(/<(?:Tab|Stack)\.Screen\b[^>]*?\bname=["']([A-Za-z][A-Za-z0-9]*)["']/gs),
    ].map((m) => m[1]);

    // Every tab is reachable by tapping it.
    if (/createBottomTabNavigator|createMaterialTopTabNavigator/.test(source)) {
      for (const name of declared) entry.add(name);
    }

    const initial = explicit?.[1] ?? declared[0];
    if (initial) entry.add(initial);
  }
  return entry;
};

describe('route reachability', () => {
  it('finds routes and navigation calls, so a broken matcher cannot pass vacuously', () => {
    expect(registeredRoutes().size).toBeGreaterThan(20);
    expect(navigationTargets().size).toBeGreaterThan(15);
  });

  it('does not mistake icon names for routes', () => {
    // `<Ionicons name="home" />` and friends use the same prop name. If the
    // matcher picked those up, the allowlist would quietly need to grow.
    for (const icon of ['bullet', 'calculator', 'cloudy', 'list']) {
      expect(registeredRoutes().has(icon)).toBe(false);
    }
  });

  it('makes every registered route reachable', () => {
    const targets = navigationTargets();
    const entryPoints = reachableWithoutACaller();
    const unreachable = [...registeredRoutes()]
      .filter((route) => !targets.has(route) && !entryPoints.has(route))
      .sort();

    expect(unreachable).toEqual([]);
  });

  it('derives entry points that are all real routes', () => {
    // The derivation reads the same files as the route scan, so a mismatch means
    // one of the two matchers has drifted.
    const routes = registeredRoutes();
    const bogus = [...reachableWithoutACaller()].filter((route) => !routes.has(route)).sort();

    expect(bogus).toEqual([]);
  });

  it('treats a tab and a stack initial route as entry points', () => {
    const entry = reachableWithoutACaller();

    expect(entry.has('Dashboard')).toBe(true); // a tab
    expect(entry.has('AllAmmoProfileList')).toBe(true); // the Ammo stack's first screen
    expect(entry.has('MainTabs')).toBe(true); // the root
  });
});
