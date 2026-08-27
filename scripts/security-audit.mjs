#!/usr/bin/env node
/**
 * Waiver-gated `npm audit`.
 *
 * Replaces `npm audit --audit-level=high || true`, which could not fail and
 * therefore gated nothing. The rule here is:
 *
 *   - any advisory at or above the configured severity that is NOT waived -> fail
 *   - any waiver whose `expires` date has passed -> fail
 *   - any waiver that is malformed -> fail
 *   - any waiver for an advisory that is no longer reported -> warn, so the list
 *     does not silently rot (a stale waiver is not a security failure, but an
 *     unreviewed one is)
 *
 * The point is not to make the number zero. It is that the set of accepted
 * advisories is explicit, attributed, and expires -- so a new one cannot slip in
 * behind the existing debt.
 *
 * Thresholds come from security-thresholds.json. See issue #45 items 1 and 9.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relative) => JSON.parse(readFileSync(path.join(repoRoot, relative), 'utf8'));

const SEVERITY_ORDER = ['info', 'low', 'moderate', 'high', 'critical'];
const GHSA = /^GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REQUIRED_FIELDS = [
  'id',
  'package',
  'severity',
  'reason',
  'disposition',
  'owner',
  'expires',
  'tracking',
];
const DISPOSITIONS = ['fixable-now', 'blocked-on-upstream', 'not-exploitable-here'];

const fail = [];
const warn = [];

const thresholds = readJson('security-thresholds.json').npmAudit;
const minIndex = SEVERITY_ORDER.indexOf(thresholds.failOn);

/**
 * Everything wrong with a single waiver, as human-readable strings.
 *
 * Mirrors security/config/audit-waivers.schema.json. Kept in step by hand rather
 * than with a validator dependency -- see loadWaivers().
 */
const waiverProblems = (waiver, where, today) => {
  const checks = [
    [
      REQUIRED_FIELDS.every((field) => waiver[field]),
      () =>
        `${where}: missing required field(s): ` +
        REQUIRED_FIELDS.filter((field) => !waiver[field]).join(', '),
    ],
    [
      !waiver.id || GHSA.test(waiver.id),
      () => `${where}: "${waiver.id}" is not a GHSA id -- waivers are per advisory`,
    ],
    [
      !waiver.disposition || DISPOSITIONS.includes(waiver.disposition),
      () => `${where}: disposition must be one of ${DISPOSITIONS.join(', ')}`,
    ],
    [
      !waiver.reason || waiver.reason.length >= 40,
      () => `${where}: reason is too short to be a reason`,
    ],
    [
      ISO_DATE.test(waiver.expires ?? ''),
      () => `${where}: expires must be an ISO date (YYYY-MM-DD)`,
    ],
    // The whole point of an expiry. A lapsed waiver reds the build until someone
    // re-reviews it or the advisory is fixed.
    [
      !ISO_DATE.test(waiver.expires ?? '') || waiver.expires >= today,
      () =>
        `${where}: waiver for ${waiver.id} (${waiver.package}) expired on ${waiver.expires}. ` +
        `Re-review it, or fix the advisory. Owner: ${waiver.owner}`,
    ],
  ];

  return checks.filter(([ok]) => !ok).map(([, describe]) => describe());
};

/**
 * Validate the waiver file against the same constraints as its JSON Schema.
 *
 * Done inline rather than with a validator dependency: this script runs in a
 * pre-push hook and must not require a network install to work.
 */
const loadWaivers = () => {
  const { waivers } = readJson(thresholds.waiverFile);
  if (!Array.isArray(waivers)) {
    fail.push(`${thresholds.waiverFile}: "waivers" must be an array`);
    return new Map();
  }

  const byId = new Map();
  const today = new Date().toISOString().slice(0, 10);

  for (const [index, waiver] of waivers.entries()) {
    for (const problem of waiverProblems(waiver, `${thresholds.waiverFile}[${index}]`, today)) {
      fail.push(problem);
    }
    if (waiver.id) byId.set(waiver.id, waiver);
  }

  return byId;
};

/**
 * Raw `npm audit --json` output, or null when it could not be produced.
 *
 * `npm audit` exits non-zero whenever it finds anything, so a non-zero exit with
 * parseable output on stdout is the normal case here, not an error.
 */
const runAudit = () => {
  const args = ['audit', '--json'];
  if (thresholds.scope === 'production') args.push('--omit=dev');

  try {
    return execFileSync('npm', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    if (error.stdout) return error.stdout;
    fail.push(`npm audit could not be run: ${error.message}`);
    return null;
  }
};

/** The GHSA id an audit `via` entry refers to, if it is at or above the threshold. */
const advisoryIdOf = (via) => {
  if (typeof via !== 'object' || SEVERITY_ORDER.indexOf(via.severity) < minIndex) return null;
  const id = String(via.url ?? '')
    .split('/')
    .pop();
  return GHSA.test(id ?? '') ? id : null;
};

/** Every distinct advisory at or above the threshold. */
const auditAdvisories = () => {
  const stdout = runAudit();
  if (!stdout) return new Map();

  const found = new Map();
  const vulnerabilities = Object.values(JSON.parse(stdout).vulnerabilities ?? {});
  for (const via of vulnerabilities.flatMap((vulnerability) => vulnerability.via ?? [])) {
    const id = advisoryIdOf(via);
    if (id) found.set(id, { package: via.name, severity: via.severity, title: via.title });
  }
  return found;
};

const waivers = loadWaivers();
const found = auditAdvisories();

for (const [id, advisory] of found) {
  if (!waivers.has(id)) {
    fail.push(
      `UNWAIVED ${advisory.severity}: ${id} in ${advisory.package} -- ${advisory.title}\n` +
        `    Fix it, or add a waiver to ${thresholds.waiverFile} ` +
        `(see security/docs/security-exceptions.md).`
    );
  }
}

for (const id of waivers.keys()) {
  if (!found.has(id)) {
    warn.push(`STALE waiver ${id} -- the advisory is no longer reported. Remove it.`);
  }
}

console.log(
  `npm audit gate: ${found.size} advisories at or above "${thresholds.failOn}" ` +
    `(scope: ${thresholds.scope}), ${waivers.size} waivers on file.`
);
for (const message of warn) console.warn(`  ! ${message}`);

if (fail.length > 0) {
  console.error(`\n${fail.length} problem(s):\n`);
  for (const message of fail) console.error(`  ✖ ${message}`);
  console.error('');
  process.exit(1);
}

console.log('  ✓ every reported advisory is individually waived and unexpired');
