import * as fs from 'fs';
import * as path from 'path';

/**
 * `security-exceptions.md`'s register agrees with the waiver file it describes.
 *
 * The register heading states how many advisories are waived. That number drifted
 * once already: it was written as 15, then `brace-expansion` and `undici` left the
 * list by being fixed rather than renewed (5d98b34, 855a330), and the heading still
 * said 15 while the file held 11. Nobody noticed, because nothing looked.
 *
 * A count in prose is the weakest kind of documentation -- it is exactly the thing a
 * reader trusts without checking and a writer forgets to update. This repository
 * already treats that as a defect rather than a nit: `releaseConfig.test.ts` makes
 * `docs/RELEASE.md`'s claims executable for the same reason. This does the same for
 * the one claim in the security register that is machine-checkable.
 *
 * It deliberately does not re-check what `scripts/security-audit.mjs` already gates
 * (schema shape, expiry, unwaived advisories). Added while waiving #169 and #170.
 */

const ROOT = path.join(__dirname, '../..');

const waivers = (
  JSON.parse(fs.readFileSync(path.join(ROOT, 'security/config/audit-waivers.json'), 'utf8')) as {
    waivers: { id: string; tracking: string; disposition: string; expires: string }[];
  }
).waivers;

/** How many waivers are waiting on the toolchain rather than on us. */
const blockedOnUpstream = waivers.filter(
  (waiver) => waiver.disposition === 'blocked-on-upstream'
).length;

const register = fs.readFileSync(path.join(ROOT, 'security/docs/security-exceptions.md'), 'utf8');

/** The one capture a register pattern must yield, or a thrown explanation. */
const statedCount = (pattern: RegExp, group = 1): number => {
  const match = pattern.exec(register);
  if (!match) {
    throw new Error(
      `security-exceptions.md no longer states a count matching ${String(pattern)}. ` +
        'If the register was reworded, update this guard to match it -- do not delete it.'
    );
  }
  return Number(match[group]);
};

/** Every count the register states about the *size* of the npm-audit waiver list. */
const statedTotals = (): number[] => [
  statedCount(/### npm audit — (\d+) advisories/),
  statedCount(/All (\d+) are transitive through/),
  // The disposition sentence states the total as well as the split, so the
  // two cannot be updated independently of each other.
  statedCount(/Disposition for (\d+) of the (\d+) is/, 2),
];

describe('the security register matches the waiver file', () => {
  it('states the number of waivers actually on file, everywhere it states one', () => {
    for (const stated of statedTotals()) {
      expect(stated).toBe(waivers.length);
    }
  });

  it('names every expiry date the waiver file actually uses', () => {
    // The count was guarded and the date was not, so the heading went on
    // claiming a single "expire 2026-11-24" after a waiver was added that
    // expires sooner -- which would have scheduled the review of the one
    // time-critical entry two and a half weeks late. A date is a promise about
    // when someone looks again; it is worth the same guard as the count.
    const heading = /### npm audit — \d+ advisories, expire ([^\n]+)/.exec(register);
    if (!heading) {
      throw new Error(
        'security-exceptions.md no longer states the npm audit expiry dates in its heading. ' +
          'If the register was reworded, update this guard to match it -- do not delete it.'
      );
    }

    for (const expires of new Set(waivers.map((waiver) => waiver.expires))) {
      expect(heading[1]).toContain(expires);
    }
  });

  it('states how many are blocked on upstream, which is no longer all of them', () => {
    // Once one waiver is `fixable-now` the register stops being able to say
    // "all N are blocked on upstream", and that distinction is the whole point
    // of the disposition field -- a debt with a date on it reads differently
    // from a decision. So the split is guarded too, not just the total.
    expect(statedCount(/Disposition for (\d+) of the (\d+) is/)).toBe(blockedOnUpstream);
    expect(blockedOnUpstream).toBeLessThan(waivers.length);
  });

  it('points every waiver at a tracking issue in this repository', () => {
    // The schema only requires a URI. A waiver whose tracking link goes nowhere
    // useful is how an exception outlives the work it was waiting for.
    for (const waiver of waivers) {
      expect(waiver.tracking).toMatch(
        /^https:\/\/github\.com\/karlgroves\/mobileDOPE\/issues\/\d+$/
      );
    }
  });
});
