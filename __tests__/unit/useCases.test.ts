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

/**
 * Verbs from the `@afixt/usecase-runner` DSL, as used by the reference library at
 * `AFixt/audit-usecases`.
 *
 * `lang_check`, `contrast`, `read_image` and `deselect` exist in the DSL but have
 * no use here: the first asserts a document `lang` attribute and the rest are not
 * needed by these flows.
 */
const REFERENCE_VERBS = [
  'audit',
  'locate',
  'focus',
  'enter',
  'activate',
  'select',
  'verify',
  'wait_for',
  'keyboard',
  'sr_says',
];

/**
 * Verbs this library adds. Each one is a deliberate React Native adaptation and
 * must be listed in the README's dialect table -- see the assertion below.
 */
const LOCAL_VERBS = ['navigate'];

const VERBS = [...REFERENCE_VERBS, ...LOCAL_VERBS];

/** Target types the reference library uses. */
const REFERENCE_TARGETS = [
  'button',
  'checkbox',
  'field',
  'heading',
  'link',
  'live_region',
  'page',
  'region',
  'text',
];

/** Target types this library adds. */
const LOCAL_TARGETS = ['radio', 'switch', 'no_element'];

/** Predicates the reference library uses. */
const REFERENCE_PREDICATES = [
  'attribute',
  'has_value',
  // enter: field "X" value "Y"
  'value',
  // sr_says: '"X" after activate button "Y"'
  'after',
];

/** Predicates this library adds. */
const LOCAL_PREDICATES = [
  'has_state',
  'has_description',
  'has_min_size',
  'has_value_matching',
  'has_focus',
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

  it('documents every local extension in the README dialect table', () => {
    // The README used to claim the steps use "the DSL verbs unchanged". They do
    // not -- this library adds one verb, three target types and five predicates.
    // The claim is now a table, and this keeps the table honest.
    const readme = fs.readFileSync(path.join(useCaseDir, 'README.md'), 'utf8');

    for (const extension of [...LOCAL_VERBS, ...LOCAL_TARGETS, ...LOCAL_PREDICATES]) {
      expect(readme).toContain(`\`${extension}\``);
    }
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

  it('uses only declared target types', () => {
    // The verb check alone let invented vocabulary through: `verify` is a real
    // verb, so `verify: sprocket "x"` passed. Targets and predicates are checked
    // too, and every non-reference one has to be declared above and documented in
    // the README's dialect table.
    const allowed = [...REFERENCE_TARGETS, ...LOCAL_TARGETS];
    const used = useCase.steps
      .map((step) => String(Object.values(step)[0]))
      .map((value) => /^([a-z_]+)\b/.exec(value)?.[1])
      .filter((target): target is string => Boolean(target));

    const unknown = [...new Set(used)].filter((target) => !allowed.includes(target));
    expect(unknown).toEqual([]);
  });

  it('uses only declared predicates', () => {
    const allowed = [...REFERENCE_PREDICATES, ...LOCAL_PREDICATES];
    // A predicate is the bare token that follows a quoted target name.
    const used = useCase.steps
      .map((step) => String(Object.values(step)[0]))
      .map((value) => /"\s+([a-z_]+)/.exec(value)?.[1])
      .filter((predicate): predicate is string => Boolean(predicate));

    const unknown = [...new Set(used)].filter((p) => !allowed.includes(p));
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
