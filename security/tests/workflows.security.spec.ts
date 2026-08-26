import fs from 'fs';
import path from 'path';

import yaml from 'js-yaml';

/**
 * Supply-chain constraints on the GitHub Actions workflows.
 *
 * Enforced as a Jest suite rather than by adding Checkov or `trivy config`:
 * ADR-011 puts the gates local-first, this runs inside the existing `npm test`
 * with no binary to install and no network, and a config scanner's generic
 * findings would still need this repo's specific rules written on top.
 *
 * See issue #45 items 4-6 and the `workflows` block of security-thresholds.json.
 */
const repoRoot = path.resolve(__dirname, '../..');
const workflowDir = path.join(repoRoot, '.github/workflows');

const thresholds = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'security-thresholds.json'), 'utf8')
) as { workflows: Record<string, boolean> };

interface Workflow {
  name: string;
  file: string;
  raw: string;
  doc: {
    permissions?: Record<string, string> | string;
    jobs?: Record<string, { permissions?: Record<string, string> | string }>;
  };
}

const workflows: Workflow[] = fs
  .readdirSync(workflowDir)
  .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
  .map((file) => {
    const raw = fs.readFileSync(path.join(workflowDir, file), 'utf8');
    return {
      name: file,
      file: path.join(workflowDir, file),
      raw,
      doc: yaml.load(raw) as Workflow['doc'],
    };
  });

/** Every `uses:` reference across all workflows, with the file it came from. */
const actionUses = workflows.flatMap((workflow) =>
  [...workflow.raw.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)/gm)].map((match) => ({
    workflow: workflow.name,
    ref: match[1] as string,
  }))
);

describe('workflow inventory', () => {
  it('finds the workflows to check', () => {
    expect(workflows.length).toBeGreaterThan(0);
    expect(actionUses.length).toBeGreaterThan(0);
  });

  it('parses every workflow as valid YAML', () => {
    for (const workflow of workflows) {
      expect(workflow.doc).toBeTruthy();
    }
  });
});

describe('least-privilege GITHUB_TOKEN', () => {
  it('every workflow declares an explicit permissions block', () => {
    // Without one, GITHUB_TOKEN inherits the repository default -- which may be
    // write -- on workflows that run `npm ci` and therefore execute dependency
    // lifecycle scripts.
    const missing = workflows
      .filter((workflow) => {
        const workflowLevel = workflow.doc.permissions !== undefined;
        const everyJobDeclares =
          workflow.doc.jobs !== undefined &&
          Object.values(workflow.doc.jobs).every((job) => job.permissions !== undefined);
        return !workflowLevel && !everyJobDeclares;
      })
      .map((workflow) => workflow.name);

    expect(missing).toEqual([]);
  });

  it('no workflow grants a write scope', () => {
    if (!thresholds.workflows.forbidWorkflowWritePermissions) return;

    /** Any write grant inside one `permissions:` block, as readable strings. */
    const writeGrants = (block: Workflow['doc']['permissions']): string[] => {
      if (block === 'write-all') return ['write-all'];
      if (!block || typeof block !== 'object') return [];
      return Object.entries(block)
        .filter(([, level]) => String(level).includes('write'))
        .map(([scope, level]) => `${scope}=${level}`);
    };

    const offenders = workflows.flatMap((workflow) =>
      [
        workflow.doc.permissions,
        ...Object.values(workflow.doc.jobs ?? {}).map((job) => job.permissions),
      ]
        .flatMap(writeGrants)
        .map((grant) => `${workflow.name}: ${grant}`)
    );

    expect(offenders).toEqual([]);
  });
});

describe('action pinning', () => {
  it('every action is pinned to a full 40-character commit SHA', () => {
    if (!thresholds.workflows.requireShaPinnedActions) return;

    // A moving tag is a promise from the action author that today's code is what
    // runs tomorrow. `actions/checkout@v6` is whatever v6 points at when the job
    // starts, including after a tag is force-moved.
    const unpinned = actionUses
      .filter(({ ref }) => !/@[0-9a-f]{40}$/.test(ref))
      .map(({ workflow, ref }) => `${workflow}: ${ref}`);

    expect(unpinned).toEqual([]);
  });

  it('every pin carries a version comment', () => {
    // The SHA is what runs; the comment is what a human reads when deciding
    // whether an update is due.
    const uncommented = workflows.flatMap((workflow) =>
      [...workflow.raw.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+@[0-9a-f]{40})(.*)$/gm)]
        .filter((match) => !/#\s*\S+/.test(match[2] ?? ''))
        .map((match) => `${workflow.name}: ${match[1]}`)
    );

    expect(uncommented).toEqual([]);
  });

  it('pins no action to a branch or to @main', () => {
    const floating = actionUses
      .filter(({ ref }) => /@(main|master|latest|HEAD)$/.test(ref))
      .map(({ workflow, ref }) => `${workflow}: ${ref}`);

    expect(floating).toEqual([]);
  });

  it('uses one pin per action across all workflows', () => {
    // Two workflows on different majors of the same action is how one of them
    // quietly stops matching the other's behaviour.
    const byAction = new Map<string, Set<string>>();
    for (const { ref } of actionUses) {
      const [action, sha] = ref.split('@') as [string, string];
      if (!byAction.has(action)) byAction.set(action, new Set());
      (byAction.get(action) as Set<string>).add(sha);
    }

    const divergent = [...byAction.entries()]
      .filter(([, shas]) => shas.size > 1)
      .map(([action, shas]) => `${action}: ${[...shas].join(', ')}`);

    expect(divergent).toEqual([]);
  });
});

describe('no gate that cannot fail', () => {
  it('declares continue-on-error only with an explanation', () => {
    // `continue-on-error: true` is what made the npm audit step decorative. It is
    // allowed, but only where the line above says why.
    const unexplained: string[] = [];
    for (const workflow of workflows) {
      const lines = workflow.raw.split('\n');
      lines.forEach((line, index) => {
        if (!/continue-on-error:\s*true/.test(line)) return;
        const preceding = lines.slice(Math.max(0, index - 6), index).join('\n');
        if (!preceding.includes('#')) {
          unexplained.push(`${workflow.name}:${index + 1}`);
        }
      });
    }

    expect(unexplained).toEqual([]);
  });
});
