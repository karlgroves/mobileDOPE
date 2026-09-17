import fs from 'fs';
import path from 'path';

import appConfig from '../../app.config';

import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * The release configuration `docs/RELEASE.md` describes (#61).
 *
 * A runbook that has drifted from the config it documents is worse than no
 * runbook: it is read at exactly the moment nobody has time to verify it. These
 * assertions are the runbook's claims, made executable.
 *
 * They are deliberately about the things that are *irreversible or expensive to
 * get wrong* -- a duplicated build number is a rejected upload, and a privacy
 * declaration that no longer matches the code is a defect rather than a
 * documentation nit (see issue #44).
 */

const easJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../eas.json'), 'utf8')) as {
  cli: { appVersionSource?: string };
  build: Record<string, { autoIncrement?: boolean; env?: Record<string, string> }>;
};

const resolve = (env?: string): ExpoConfig => {
  const previous = process.env.APP_ENV;
  if (env === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = env;
  try {
    return appConfig({ config: {} } as unknown as ConfigContext);
  } finally {
    if (previous === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = previous;
  }
};

describe('build numbering has exactly one source', () => {
  it('lets EAS own the build number', () => {
    expect(easJson.cli.appVersionSource).toBe('remote');
    expect(easJson.build.production.autoIncrement).toBe(true);
  });

  it('does not also set it locally', () => {
    // Two sources for one number is how a build gets rejected for reusing a
    // version that has already been uploaded -- and the rejection arrives after
    // the build has run, not before.
    for (const env of ['development', 'staging', 'production']) {
      const config = resolve(env);
      expect(config.ios?.buildNumber).toBeUndefined();
      expect(config.android?.versionCode).toBeUndefined();
    }
  });

  it('takes the user-facing version from package.json alone', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
    ) as { version: string };

    expect(resolve('production').version).toBe(pkg.version);
  });
});

describe('builds install side by side', () => {
  it('gives each environment its own identifier', () => {
    // Otherwise installing a staging build over a production one silently
    // replaces it, taking the user's database with it.
    const ids = ['development', 'staging', 'production'].map((env) => [
      resolve(env).ios?.bundleIdentifier,
      resolve(env).android?.package,
    ]);

    expect(new Set(ids.map(String)).size).toBe(3);
  });

  it('but keeps one deep link scheme across all of them', () => {
    // The opposite decision, for the opposite reason: a link is written against
    // the scheme, not against the build.
    const schemes = ['development', 'staging', 'production'].map((env) => resolve(env).scheme);

    expect(new Set(schemes).size).toBe(1);
  });
});

describe('the encryption declaration still matches the code', () => {
  it('claims no non-exempt encryption', () => {
    expect(resolve('production').ios?.config?.usesNonExemptEncryption).toBe(false);
  });

  it('and nothing in src/ has acquired a crash-reporting SDK', () => {
    // The declaration above, PRIVACY.md and offlineFirst.test.ts all rest on the
    // same fact. #61 asks for Sentry or Crashlytics; docs/RELEASE.md records why
    // that needs a decision first rather than an npm install.
    //
    // This deliberately overlaps offlineFirst.test.ts, which sweeps the same tree
    // for HTTP clients. The questions differ -- "has a reporting SDK appeared"
    // versus "has a network call appeared" -- and neither should have to wait on
    // the other's branch to land. Worth folding the two walks together once both
    // have; until then the duplication is the cheaper of the two problems.
    //
    // This deliberately overlaps offlineFirst.test.ts, which sweeps the same tree
    // for HTTP clients. The questions differ -- "has a reporting SDK appeared"
    // versus "has a network call appeared" -- and neither should have to wait on
    // the other's branch. Worth folding the two walks together once both have
    // landed; until then the duplication is the cheaper of the two problems.
    const srcDir = path.resolve(__dirname, '../../src');
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return /\.tsx?$/.test(entry.name) ? [fs.readFileSync(full, 'utf8')] : [];
      });

    const sources = walk(srcDir);
    expect(sources.length).toBeGreaterThan(40);

    const offenders = sources.filter((source) =>
      /from\s+['"](@sentry\/|@react-native-firebase\/crashlytics|bugsnag)/.test(source)
    );

    expect(offenders).toHaveLength(0);
  });
});
