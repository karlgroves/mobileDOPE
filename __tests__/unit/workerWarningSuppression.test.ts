import fs from 'fs';
import path from 'path';

// `jest.globalSetup.js` is CommonJS and deliberately not TypeScript: jest loads
// globalSetup before any transform is available to it. The disables below cover
// that, and the constant names, which mirror the module's own exports rather
// than this file's conventions.
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/naming-convention */
interface GlobalSetupModule {
  FORCE_EXIT_MESSAGE: string;
  NOTICE: string;
  isForceExitWarning: (args: unknown[]) => boolean;
  install: (target: { error: (...args: unknown[]) => void }) => void;
}
const setup = require('../../jest.globalSetup.js') as GlobalSetupModule;
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/naming-convention */

/**
 * The jest-worker force-exit warning is replaced, not dropped (#77).
 *
 * The risk in suppressing anything is that a real problem later prints the same
 * text and nobody sees it. So the tests that matter here are the ones about what
 * still gets through: an unrelated console.error must be untouched, and the
 * force-exit case must still say it happened.
 */

const root = path.resolve(__dirname, '../..');

/** Records what reached the underlying console.error. */
const spyConsole = (): { error: (...args: unknown[]) => void; calls: unknown[][] } => {
  const calls: unknown[][] = [];
  return {
    error: (...args: unknown[]) => {
      calls.push(args);
    },
    calls,
  };
};

/** The ESC that chalk emits, built rather than typed so the source stays plain text. */
const ESC = String.fromCharCode(27);

describe('what the filter matches', () => {
  it('matches the real message, colourised or not', () => {
    const plain = `${setup.FORCE_EXIT_MESSAGE} and has been force exited.`;
    // chalk wraps the whole string, so an equality check would depend on whether
    // jest decided to colourise. This is why it is a substring match.
    const colourised = `${ESC}[33m${plain}${ESC}[39m`;

    expect(setup.isForceExitWarning([plain])).toBe(true);
    expect(setup.isForceExitWarning([colourised])).toBe(true);
  });

  it('leaves every other console.error alone', () => {
    // The assertion that keeps this honest. A filter that swallowed anything
    // else would hide real failures, which is a far worse trade than the noise
    // it was introduced to remove.
    expect(setup.isForceExitWarning(['Database initialization failed:'])).toBe(false);
    expect(setup.isForceExitWarning(['Failed to import rifle:', new Error('x')])).toBe(false);
    expect(setup.isForceExitWarning([])).toBe(false);
    expect(setup.isForceExitWarning([new Error('not a string')])).toBe(false);
    expect(setup.isForceExitWarning([undefined])).toBe(false);
  });
});

describe('what the replacement prints', () => {
  it('still reports that a worker was force-exited', () => {
    // Replaced, not silenced. If this ever becomes a real leak, the event is
    // still on screen -- just in one line instead of four.
    const target = spyConsole();
    setup.install(target);

    target.error(`${setup.FORCE_EXIT_MESSAGE} and has been force exited.`);

    expect(target.calls).toHaveLength(1);
    expect(String(target.calls[0][0])).toBe(setup.NOTICE);
    expect(setup.NOTICE).toMatch(/force-exited/);
  });

  it('points at the document that explains it', () => {
    // A notice nobody can act on is just quieter noise.
    expect(setup.NOTICE).toContain('docs/adr/013-jest-worker-force-exit.md');
    expect(fs.existsSync(path.join(root, 'docs/adr/013-jest-worker-force-exit.md'))).toBe(true);
  });

  it('passes unrelated errors through with their arguments intact', () => {
    const target = spyConsole();
    setup.install(target);
    const cause = new Error('boom');

    target.error('Database initialization failed:', cause);

    expect(target.calls).toEqual([['Database initialization failed:', cause]]);
  });

  it('does not stack wrappers when installed twice', () => {
    // globalSetup is a per-project option and jest.config.js sets it on both
    // projects, so install() runs twice in the same parent process. Without the
    // marker the second call would wrap the first and the notice would double.
    const target = spyConsole();
    setup.install(target);
    setup.install(target);

    target.error(`${setup.FORCE_EXIT_MESSAGE} and has been force exited.`);

    expect(target.calls).toHaveLength(1);
  });
});

describe('it is actually wired in', () => {
  it('runs for both jest projects', () => {
    // A suppression that is not installed is just a file. Both projects need it
    // because globalSetup is per-project.
    const config = fs.readFileSync(path.join(root, 'jest.config.js'), 'utf8');
    const occurrences = config.match(/globalSetup: '<rootDir>\/jest\.globalSetup\.js'/g) ?? [];

    expect(occurrences).toHaveLength(2);
  });
});
