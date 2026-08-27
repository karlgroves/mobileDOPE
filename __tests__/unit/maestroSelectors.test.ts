import fs from 'fs';
import path from 'path';

/**
 * Which Maestro selectors correspond to something in `src/`, and which do not.
 *
 * The flows in `.maestro/` were authored without a device — this machine has
 * Command Line Tools rather than full Xcode, so there is no simulator and no way
 * to run them. That makes every selector a hypothesis. Two of them were worse
 * than that: `journeys/rifle-to-dope-card.yaml` tapped `id: 'create-rifle-button'`
 * and `id: 'create-ammo-button'`, neither of which exists anywhere in the app, so
 * the flagship journey could not have run past its second step.
 *
 * This test turns "unverified" into a tracked list. A literal selector must
 * either appear verbatim in `src/`, or be listed below with a reason. It cannot
 * catch a selector that exists but is attached to the wrong element — only a real
 * device run does that — but it does catch one that exists nowhere at all.
 *
 * See issue #20 and docs/E2E_TESTING.md.
 */
const repoRoot = path.resolve(__dirname, '../..');
const flowDir = path.join(repoRoot, '.maestro');

/**
 * Text the flow itself creates, so it will never appear in source.
 *
 * Profile names, entered values, and counts the app renders from data.
 */
const FLOW_CREATED_DATA = ['Tikka T3x', '175gr SMK', 'Shots fired, 1', 'DOPE card generated'];

/**
 * Labels that arrive with another open PR.
 *
 * Empty: #46 (consent copy) and #47 (accessibility labels) have both landed, and
 * every entry that was here is now present in `src/`. The `keeps the pending list
 * honest` assertion below flagged all eight as stale the moment those merged,
 * which is the point of tracking them here rather than in prose.
 *
 * Add entries again only for labels genuinely arriving with a named open PR.
 */
const PENDING_FROM_OTHER_PRS: Record<string, string> = {};

/**
 * Selectors matching neither of the above, kept deliberately so the flow is
 * complete and the gap is visible. Each needs checking on the first device run.
 */
const UNVERIFIED_ON_DEVICE = [
  'Fetch GPS Data',
  'Ballistic Coefficient (G7)',
  'Start distance, yards',
  'End distance, yards',
  'Generate DOPE card',
];

const sourceText = (): string => {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return /\.tsx?$/.test(entry.name) ? [fs.readFileSync(full, 'utf8')] : [];
    });
  return walk(path.join(repoRoot, 'src')).join('\n');
};

/** Every literal string a flow uses to find something on screen. */
const selectors = (): { flow: string; selector: string }[] => {
  const found: { flow: string; selector: string }[] = [];
  for (const file of fs.readdirSync(flowDir, { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('.yaml') || file === 'config.yaml') continue;
    const raw = fs.readFileSync(path.join(flowDir, file), 'utf8');
    for (const match of raw.matchAll(
      /(?:tapOn|assertVisible|assertNotVisible|element):\s*'([^']+)'/g
    )) {
      found.push({ flow: file, selector: match[1] as string });
    }
  }
  return found;
};

describe('maestro selectors', () => {
  const src = sourceText();
  const all = selectors();

  it('finds selectors to check', () => {
    expect(all.length).toBeGreaterThan(20);
  });

  it('uses no testID that does not exist', () => {
    // The defect this file was written for. `id:` selectors are checked strictly:
    // unlike a visible label, a testID has no reason to be absent from source.
    const ids: string[] = [];
    for (const file of fs.readdirSync(flowDir, { recursive: true, encoding: 'utf8' })) {
      if (!file.endsWith('.yaml')) continue;
      const raw = fs.readFileSync(path.join(flowDir, file), 'utf8');
      for (const match of raw.matchAll(/id:\s*'([^']+)'/g)) {
        if (!src.includes(match[1] as string)) ids.push(`${file}: ${match[1]}`);
      }
    }
    expect(ids).toEqual([]);
  });

  it('accounts for every selector: present in src, or listed with a reason', () => {
    const unaccounted = all.filter(
      ({ selector }) =>
        !src.includes(selector) &&
        !FLOW_CREATED_DATA.includes(selector) &&
        !(selector in PENDING_FROM_OTHER_PRS) &&
        !UNVERIFIED_ON_DEVICE.includes(selector)
    );

    expect(unaccounted.map(({ flow, selector }) => `${flow}: ${selector}`)).toEqual([]);
  });

  it('keeps the pending list honest as other PRs land', () => {
    // Once a PR merges, its labels should be in src and the entry should go. A
    // stale entry means someone forgot to re-check, which is how a tracked gap
    // becomes a permanent one.
    const stale = Object.keys(PENDING_FROM_OTHER_PRS).filter((selector) => src.includes(selector));

    expect(stale).toEqual([]);
  });

  it('does not let the unverified list grow silently', () => {
    // A cap, not a target. Every entry needs a device run to confirm; the number
    // should only ever go down.
    expect(UNVERIFIED_ON_DEVICE.length).toBeLessThanOrEqual(5);
  });
});
