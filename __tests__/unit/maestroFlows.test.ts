import fs from 'fs';
import path from 'path';

import yaml from 'js-yaml';

/**
 * Structural validation of the Maestro E2E flows.
 *
 * These flows cannot run in this Jest suite -- they need a built app, a booted
 * device and the Maestro binary. That is exactly why they need checking here: a
 * typo in a flow otherwise surfaces minutes into a device run, on a machine that
 * has all three, which is the slowest possible feedback loop in this repo.
 *
 * This is the same bargain as __tests__/unit/useCases.test.ts. See issue #20 and
 * docs/E2E_TESTING.md.
 */
const flowDir = path.resolve(__dirname, '../../.maestro');

/** Maestro commands used by these flows. Extend deliberately, not reflexively. */
const COMMANDS = [
  'launchApp',
  'tapOn',
  'doubleTapOn',
  'longPressOn',
  'inputText',
  'hideKeyboard',
  'assertVisible',
  'assertNotVisible',
  'extendedWaitUntil',
  'scrollUntilVisible',
  'scroll',
  'swipe',
  'back',
  'takeScreenshot',
  'waitForAnimationToEnd',
  'stopApp',
  'clearState',
  'runFlow',
  'repeat',
];

interface FlowHeader {
  appId: string;
  tags?: string[];
}

const flowFiles = fs
  .readdirSync(flowDir, { recursive: true, encoding: 'utf8' })
  .filter((entry) => entry.endsWith('.yaml') && entry !== 'config.yaml')
  .sort();

/** A flow file is two YAML documents: a header, then the command list. */
const load = (file: string): { header: FlowHeader; steps: unknown[] } => {
  const raw = fs.readFileSync(path.join(flowDir, file), 'utf8');
  const documents = yaml.loadAll(raw);
  return {
    header: documents[0] as FlowHeader,
    steps: (documents[1] ?? []) as unknown[],
  };
};

const commandOf = (step: unknown): string =>
  typeof step === 'string' ? step : (Object.keys(step as object)[0] as string);

describe('maestro configuration', () => {
  const config = yaml.load(fs.readFileSync(path.join(flowDir, 'config.yaml'), 'utf8')) as {
    appId: string;
    flows: string[];
    excludeTags: string[];
  };

  it('declares an app id matching the development build', () => {
    // app.config.ts appends the APP_ENV to the bundle identifier for non-production.
    expect(config.appId).toBe('com.mobiledope.app.development');
  });

  it('globs both flow directories', () => {
    expect(config.flows).toEqual(expect.arrayContaining(['smoke/*.yaml', 'journeys/*.yaml']));
  });

  it('excludes destructive flows by default', () => {
    // A stray local run must not be able to wipe a device holding real DOPE.
    expect(config.excludeTags).toContain('destructive');
  });

  it('finds flows to check', () => {
    expect(flowFiles.length).toBeGreaterThanOrEqual(4);
  });
});

describe('flow coverage', () => {
  it('has at least one smoke flow and one critical journey', () => {
    // The issue's acceptance criteria: a smoke test and at least one critical
    // user journey.
    const tags = flowFiles.flatMap((file) => load(file).header.tags ?? []);
    expect(tags).toContain('smoke');
    expect(tags).toContain('journey');
  });

  it('covers the core loop end to end', () => {
    expect(flowFiles).toContain('journeys/rifle-to-dope-card.yaml');
  });

  it('covers the location-denied path', () => {
    // PRIVACY.md promises the app stays usable with location declined, and the
    // system permission dialog is the one thing a unit test cannot reach.
    expect(flowFiles).toContain('journeys/environment-location-denied.yaml');
  });
});

describe.each(flowFiles)('%s', (file) => {
  const { header, steps } = load(file);

  it('parses as two YAML documents', () => {
    expect(header).toBeTruthy();
    expect(Array.isArray(steps)).toBe(true);
  });

  it('declares the same appId as the config', () => {
    expect(header.appId).toBe('com.mobiledope.app.development');
  });

  it('is tagged', () => {
    // Untagged flows cannot be selected or excluded, which makes the destructive
    // exclusion in config.yaml unenforceable.
    expect(header.tags?.length ?? 0).toBeGreaterThan(0);
  });

  it('launches the app before doing anything else', () => {
    expect(commandOf(steps[0])).toBe('launchApp');
  });

  it('uses only known Maestro commands', () => {
    const used = steps.map(commandOf);
    const unknown = [...new Set(used)].filter((command) => !COMMANDS.includes(command));
    expect(unknown).toEqual([]);
  });

  it('waits for the first screen rather than assuming it has painted', () => {
    // The database opens and migrations run before the first paint. A bare
    // assertVisible here is the flakiest thing you can write.
    const used = steps.map(commandOf);
    expect(used).toContain('extendedWaitUntil');
  });

  it('asserts something, not just taps through', () => {
    const used = steps.map(commandOf);
    expect(used.some((command) => command.startsWith('assert'))).toBe(true);
  });

  it('tags any flow that clears state as destructive', () => {
    const clearsState = steps.some(
      (step) =>
        typeof step === 'object' &&
        step !== null &&
        'launchApp' in step &&
        (step as { launchApp?: { clearState?: boolean } }).launchApp?.clearState === true
    );

    if (clearsState) {
      expect(header.tags).toContain('destructive');
    }
  });
});
