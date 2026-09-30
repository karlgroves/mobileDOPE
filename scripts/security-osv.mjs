#!/usr/bin/env node
/**
 * Severity-gated `osv-scanner`.
 *
 * osv-scanner has no built-in severity threshold -- it exits non-zero on any
 * finding at all. Wiring that straight into a pre-push hook would block every
 * push on the same ~40 known transitive advisories, and a gate that always fails
 * gets bypassed within a day.
 *
 * This fails only at or above the CVSS threshold in security-thresholds.json,
 * and prints everything below it so nothing is hidden. It honours the same waiver
 * register as the npm audit gate -- one advisory, one decision, one place to
 * record it. A waiver granted there should not have to be granted again here, and
 * expiring one should close both gates at once.
 *
 * Issue #45 item 4.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(path.join(repoRoot, 'security-thresholds.json'), 'utf8'));
const thresholds = config.osvScanner;

/**
 * GHSA ids waived for the npm audit gate.
 *
 * Expiry is enforced by scripts/security-audit.mjs, which runs first in both the
 * pre-push hook and `security:all`; duplicating that check here would report the
 * same lapsed waiver twice.
 */
const waived = new Set(
  JSON.parse(readFileSync(path.join(repoRoot, config.npmAudit.waiverFile), 'utf8')).waivers.map(
    (waiver) => waiver.id
  )
);

/** CVSS v3 base-score floor for each qualitative rating. */
const CVSS_FLOOR = { LOW: 0.1, MEDIUM: 4.0, HIGH: 7.0, CRITICAL: 9.0 };
const floor = CVSS_FLOOR[thresholds.failOn] ?? CVSS_FLOOR.CRITICAL;

let stdout;
try {
  stdout = execFileSync(
    'osv-scanner',
    ['--lockfile=package-lock.json', '--format=json'],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
} catch (error) {
  // Non-zero exit with output is the normal case: osv-scanner exits 1 on findings.
  stdout = error.stdout;
  if (!stdout) {
    console.error(`osv-scanner could not be run: ${error.message}`);
    process.exit(1);
  }
}

const findings = [];
for (const result of JSON.parse(stdout).results ?? []) {
  for (const pkg of result.packages ?? []) {
    for (const group of pkg.groups ?? []) {
      const score = Number.parseFloat(group.max_severity ?? '0');
      const ids = group.ids ?? [];
      findings.push({
        package: `${pkg.package.name}@${pkg.package.version}`,
        ids: ids.join(', '),
        score: Number.isNaN(score) ? 0 : score,
        // Waived only when every id in the group is individually waived.
        waived: ids.length > 0 && ids.every((id) => waived.has(id)),
      });
    }
  }
}

const atThreshold = findings.filter((finding) => finding.score >= floor);
const blocking = atThreshold.filter((finding) => !finding.waived);
const waivedAtThreshold = atThreshold.length - blocking.length;

console.log(
  `osv-scanner: ${findings.length} advisories in the lockfile; ` +
    `${atThreshold.length} at or above ${thresholds.failOn} (CVSS ${floor}).`
);
console.log(
  `  ${waivedAtThreshold} of those are individually waived in ${config.npmAudit.waiverFile}; ` +
    `${findings.length - atThreshold.length} sit below the threshold and are reported only.`
);

if (blocking.length > 0) {
  console.error('');
  for (const finding of blocking.sort((a, b) => b.score - a.score)) {
    console.error(`  ✖ CVSS ${finding.score.toFixed(1)}  ${finding.package}  ${finding.ids}`);
  }
  console.error('');
  process.exit(1);
}

console.log('  ✓ nothing at or above the threshold');
