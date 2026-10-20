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
    waivers: { id: string; tracking: string }[];
  }
).waivers;

const register = fs.readFileSync(path.join(ROOT, 'security/docs/security-exceptions.md'), 'utf8');

/** Every count the register states about the npm-audit waiver list. */
const statedCounts = (): number[] => {
  const patterns = [
    /### npm audit — (\d+) advisories/,
    /All (\d+) are transitive through/,
    /Disposition for all (\d+) is/,
  ];
  return patterns.map((pattern) => {
    const match = pattern.exec(register);
    if (!match) {
      throw new Error(
        `security-exceptions.md no longer states a count matching ${String(pattern)}. ` +
          'If the register was reworded, update this guard to match it -- do not delete it.'
      );
    }
    return Number(match[1]);
  });
};

describe('the security register matches the waiver file', () => {
  it('states the number of waivers actually on file, everywhere it states one', () => {
    for (const stated of statedCounts()) {
      expect(stated).toBe(waivers.length);
    }
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
