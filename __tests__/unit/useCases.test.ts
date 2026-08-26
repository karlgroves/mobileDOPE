import fs from 'fs';
import path from 'path';

import yaml from 'js-yaml';

/**
 * Structural validation of the use-case library.
 *
 * The `@afixt/usecase-runner` DSL is used here as an authoring format only -- its
 * Playwright codegen is ruled out by ADR-009 (there is no browser surface to
 * drive). That means nothing else validates these files, so a typo would sit
 * undetected until #20 tried to translate them into Maestro flows.
 *
 * These assertions are the substitute for the runner's own zod schema. See
 * docs/use-cases/README.md and issue #18.
 */
const useCaseDir = path.resolve(__dirname, '../../docs/use-cases');

/** Verbs from the DSL. `lang_check` is omitted: it has no React Native meaning. */
const VERBS = [
  'audit',
  'locate',
  'focus',
  'enter',
  'activate',
  'select',
  'verify',
  'wait_for',
  'navigate',
  'keyboard',
  'sr_says',
];

const REQUIRED_FIELDS = [
  'id',
  'title',
  'type',
  'description',
  'preconditions',
  'start_location',
  'expected_result',
  'data',
  'steps',
];

interface UseCase {
  id: string;
  title: string;
  type: string;
  description: string;
  preconditions: string[];
  start_location: string;
  expected_result: string;
  data: Record<string, string>;
  steps: Record<string, string>[];
}

const files = fs
  .readdirSync(useCaseDir, { recursive: true, encoding: 'utf8' })
  .filter((entry) => entry.endsWith('.uc.yaml'))
  .sort();

const load = (file: string): UseCase =>
  yaml.load(fs.readFileSync(path.join(useCaseDir, file), 'utf8')) as UseCase;

describe('use-case library', () => {
  it('contains a use case for every flow listed in the README', () => {
    const readme = fs.readFileSync(path.join(useCaseDir, 'README.md'), 'utf8');
    const listed = [...readme.matchAll(/`([\w-]+\/[\w-]+\.uc\.yaml)`/g)].map((m) => m[1] as string);

    expect(listed.length).toBeGreaterThan(0);
    expect([...new Set(listed)].sort()).toEqual(files);
  });

  it('covers every mounted tab stack', () => {
    // Grounded in src/navigation/TabNavigator.tsx: a stack with no use case is a
    // part of the app nobody has described.
    const areas = new Set(files.map((file) => file.split('/')[0]));
    expect([...areas].sort()).toEqual([
      'ammo',
      'calculator',
      'dashboard',
      'history',
      'rifles',
      'session',
      'settings',
    ]);
  });

  it('includes negative as well as positive flows', () => {
    const negatives = files.map(load).filter((useCase) => useCase.type === 'negative');
    expect(negatives.length).toBeGreaterThanOrEqual(4);
  });

  it('gives every use case a unique id', () => {
    const ids = files.map((file) => load(file).id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe.each(files)('%s', (file) => {
  const useCase = load(file);

  it('parses as YAML into an object', () => {
    expect(typeof useCase).toBe('object');
  });

  it('declares every required field', () => {
    const missing = REQUIRED_FIELDS.filter(
      (field) => useCase[field as keyof UseCase] === undefined
    );
    expect(missing).toEqual([]);
  });

  it('has an id matching its path', () => {
    const [area, base] = file.replace('.uc.yaml', '').split('/') as [string, string];
    expect(useCase.id).toBe(`${area}-${base}`);
  });

  it('is typed positive or negative', () => {
    expect(['positive', 'negative']).toContain(useCase.type);
  });

  it('names a start location as Stack/Screen or a tab route', () => {
    // React Native adaptation: routes, not URLs. See docs/use-cases/README.md.
    expect(useCase.start_location).toMatch(/^[A-Z][A-Za-z]*(\/[A-Z][A-Za-z]*)?$/);
    expect(useCase.start_location).not.toMatch(/^https?:/);
  });

  it('states preconditions and an expected result', () => {
    expect(Array.isArray(useCase.preconditions)).toBe(true);
    expect(useCase.preconditions.length).toBeGreaterThan(0);
    expect(useCase.expected_result.length).toBeGreaterThan(40);
  });

  it('uses only DSL verbs in its steps', () => {
    const used = useCase.steps.map((step) => Object.keys(step)[0] as string);
    const unknown = [...new Set(used)].filter((verb) => !VERBS.includes(verb));
    expect(unknown).toEqual([]);
  });

  it('has at least one interaction, not just assertions', () => {
    const used = useCase.steps.map((step) => Object.keys(step)[0]);
    expect(
      used.some((verb) => ['activate', 'enter', 'select', 'keyboard'].includes(verb as string))
    ).toBe(true);
  });

  it('references only data keys it defines', () => {
    const defined = new Set(Object.keys(useCase.data));
    const referenced = new Set<string>();
    for (const step of useCase.steps) {
      const value = String(Object.values(step)[0]);
      for (const match of value.matchAll(/\{\{\s*([\w_]+)\s*\}\}/g)) {
        referenced.add(match[1] as string);
      }
    }

    const undefinedKeys = [...referenced].filter((key) => !defined.has(key));
    expect(undefinedKeys).toEqual([]);
  });

  it('documents every data value with a REPLACE-style comment somewhere in the file', () => {
    const raw = fs.readFileSync(path.join(useCaseDir, file), 'utf8');
    // The reference library annotates data values so a reader knows what to
    // substitute. At minimum each file must carry guidance.
    expect(raw).toMatch(/# REPLACE:/);
  });
});
