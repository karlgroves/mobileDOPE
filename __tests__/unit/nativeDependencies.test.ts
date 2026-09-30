import * as fs from 'fs';
import * as path from 'path';

/**
 * Every native module the app links is the version its Expo SDK was built for.
 *
 * Native modules are linked from the top of node_modules, and a package that
 * only arrives as someone's peer lands there at whatever version npm picks.
 * Twice that was not the SDK's: victory-native's Skia and Reanimated peers
 * (#139), and expo-font, which @expo/vector-icons's `>=14.0.4` peer range
 * resolved to 14.0.11 - an SDK 54 module linked into an SDK 55 app, beside the
 * SDK 55 copy expo itself uses (#137). The fix both times was to declare the
 * package at the SDK's version; this keeps it that way.
 */

const ROOT = path.join(__dirname, '../..');
const read = <T>(file: string): T =>
  JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')) as T;

// The versions this SDK release was built and tested with, shipped in expo.
const pins = read<Record<string, string>>('node_modules/expo/bundledNativeModules.json');

/**
 * Whether `version` meets an Expo pin. The pins only ever take three forms -
 * `~x.y.z`, `^x.y.z` or an exact version - so they are matched here rather
 * than through `semver`, which this project only has as someone else's
 * dependency (the mistake this test exists to catch). Anything else throws.
 */
const meets = (version: string, pin: string): boolean => {
  const parse = (v: string) => v.split('-')[0].split('.').map(Number);
  const m = /^([~^]?)(\d+\.\d+\.\d+)$/.exec(pin);
  if (!m) throw new Error(`Unsupported Expo pin: ${pin}`);
  const [op, base] = [m[1], parse(m[2])];
  const v = parse(version);
  const atLeast =
    v[0] !== base[0] ? v[0] > base[0] : v[1] !== base[1] ? v[1] > base[1] : v[2] >= base[2];
  if (op === '') return v.join('.') === base.join('.');
  if (op === '~') return v[0] === base[0] && v[1] === base[1] && atLeast;
  return v[0] === base[0] && atLeast;
};

const installed = (name: string): string | undefined => {
  const file = path.join(ROOT, 'node_modules', name, 'package.json');
  return fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, 'utf8')) as { version: string }).version
    : undefined;
};

describe('the pin matcher', () => {
  it.each([
    ['55.0.8', '~55.0.8', true],
    ['55.0.31', '~55.0.8', true],
    ['55.1.0', '~55.0.8', false],
    ['14.0.11', '~55.0.8', false],
    ['55.0.7', '~55.0.8', false],
    ['2.4.18', '2.4.18', true],
    ['2.6.2', '2.4.18', false],
    ['4.3.0', '^4.2.1', true],
    ['5.0.0', '^4.2.1', false],
  ])('%s against %s is %s', (version, pin, expected) => {
    expect(meets(version, pin)).toBe(expected);
  });
});

describe('native modules match the Expo SDK', () => {
  it('reads the SDK pins, so this cannot pass on an empty list', () => {
    expect(Object.keys(pins).length).toBeGreaterThan(50);
    expect(pins['expo-font']).toBeDefined();
  });

  it('has every SDK-pinned package that is installed at the top level within its pin', () => {
    const outOfLine = Object.entries(pins)
      .map(([name, range]) => ({ name, range, version: installed(name) }))
      .filter(({ version, range }) => version !== undefined && !meets(version, range))
      .map(({ name, version, range }) => `${name} ${version} (SDK wants ${range})`);

    expect(outOfLine).toEqual([]);
  });

  it('lets every top-level SDK package resolve the SDK packages it imports', () => {
    // expo-font imports expo-asset without declaring it - it relies on expo to
    // supply it - and expo-asset sat only under node_modules/expo, so from the
    // top level it could not be found: "Cannot find module 'expo-asset'" in
    // Jest, and why RootNavigator could not be rendered in a test (#137). The
    // manifests do not show this, so the built code's imports are read.
    const importsOf = (dir: string): string[] => {
      const build = path.join(dir, 'build');
      if (!fs.existsSync(build)) return [];
      const found = new Set<string>();
      const walk = (d: string) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          const full = path.join(d, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (/\.js$/.test(entry.name) && !/\.web\.js$/.test(entry.name)) {
            // Code only: doc comments show imports of optional packages
            // (expo-location's JSDoc imports expo-task-manager).
            const code = fs
              .readFileSync(full, 'utf8')
              .split('\n')
              .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
              .join('\n');
            for (const m of code.matchAll(
              /(?:from\s+|require\()\s*['"]((?:@[^/'"]+\/)?[^/'"]+)/g
            )) {
              found.add(m[1]);
            }
          }
        }
      };
      walk(build);
      return [...found];
    };

    const unresolved: string[] = [];
    for (const name of Object.keys(pins)) {
      const dir = path.join(ROOT, 'node_modules', name);
      if (!fs.existsSync(path.join(dir, 'package.json'))) continue;
      for (const dep of importsOf(dir).filter((d) => d !== name && d in pins)) {
        try {
          require.resolve(`${dep}/package.json`, { paths: [dir] });
        } catch {
          unresolved.push(`${name} -> ${dep}`);
        }
      }
    }

    expect(unresolved).toEqual([]);
  });

  it('declares expo-font itself rather than taking whatever a peer range resolves to', () => {
    const { dependencies } = read<{ dependencies: Record<string, string> }>('package.json');
    expect(dependencies['expo-font']).toBeDefined();
  });
});
