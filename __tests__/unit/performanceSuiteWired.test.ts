import fs from 'fs';
import path from 'path';

/**
 * The performance suite still exists and is still reachable.
 *
 * `solverPerformance.test.ts` was moved out of `npm test` because wall-clock
 * assertions and a 71-suite parallel run are in tension: it failed roughly one
 * run in ten while the ratio it measures never left 2.2-2.7 against a threshold
 * of 4.5. Moving it was the right call. It also created a new risk, which is
 * what this file is for.
 *
 * A suite that nothing runs is a suite that rots. It gets a compile error nobody
 * sees, or the script gets renamed, or someone deletes the config while tidying
 * -- and the first anyone knows is that a regression it would have caught ships.
 * This runs in the default suite and fails if any of the three pieces goes
 * missing.
 *
 * It deliberately does NOT execute the performance tests. That would put the
 * timing back inside the parallel run and undo the whole point.
 */

const root = path.resolve(__dirname, '../..');
const read = (relative: string): string => fs.readFileSync(path.join(root, relative), 'utf8');

const packageJson = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

describe('the performance suite is wired up', () => {
  it('has tests to run', () => {
    const dir = path.join(root, '__tests__/performance');

    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.readdirSync(dir).filter((f) => /\.(test|spec)\.tsx?$/.test(f))).not.toEqual([]);
  });

  it('has a config that points at them', () => {
    // Loaded, not grepped. The first version of this test read the file as text
    // and asserted it contained '__tests__/performance' -- which the comments at
    // the top do, so pointing testMatch at a directory that does not exist
    // passed. Presence of a string is not the same as the config being right,
    // which is the exact mistake #107's review caught in the distance sweep.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require('../../jest.performance.config.js') as { testMatch?: string[] };

    expect(config.testMatch).toBeDefined();
    expect(config.testMatch?.some((pattern) => pattern.includes('__tests__/performance'))).toBe(
      true
    );
  });

  it('has a config whose patterns actually match the tests that exist', () => {
    // Stronger still: the pattern has to select real files. A directory rename
    // on either side leaves both halves individually plausible and the suite
    // running nothing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require('../../jest.performance.config.js') as { testMatch: string[] };

    const dirs = config.testMatch
      .map((pattern) => pattern.replace(/^\*\*\//, '').split('/**/')[0])
      .map((dir) => path.join(root, dir));

    const files = dirs
      .filter((dir) => fs.existsSync(dir))
      .flatMap((dir) => fs.readdirSync(dir))
      .filter((file) => /\.(test|spec)\.tsx?$/.test(file));

    expect(files).not.toEqual([]);
  });

  it('has a script that runs that config, in band', () => {
    // `--runInBand` is the reason this suite was moved. Without it the tests are
    // back to sharing the machine with whatever else jest is running, which is
    // the flakiness they were removed from.
    const script = packageJson.scripts['test:perf'];

    expect(script).toBeDefined();
    expect(script).toContain('jest.performance.config.js');
    expect(script).toContain('--runInBand');
  });

  it('is kept out of the default suite', () => {
    // The other half. If `jest.config.js` ever matched the performance
    // directory, the flake would come back silently.
    const config = read('jest.config.js');

    expect(config).not.toContain('__tests__/performance');
  });

  it('is documented where someone will look for it', () => {
    // A release runbook that lists the gate but not this suite is how it stops
    // being run at all.
    expect(read('docs/RELEASE.md')).toContain('test:perf');
  });
});
