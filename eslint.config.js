// Flat ESLint config for the Mobile DOPE app (#75).
//
// This is a REACT NATIVE / Expo project. It ran on the legacy `.eslintrc` format
// via `ESLINT_USE_FLAT_CONFIG=false` because that is what `eslint-config-expo`
// used to assume (see docs/adr/007). Expo SDK 55 ships `eslint-config-expo/flat`,
// so the flag is no longer needed and ESLint 9 runs its own default format.
//
// The rule set is a FAITHFUL TRANSLATION of the eslintrc it replaces, not a
// rewrite. Every rule, severity and option below was carried across unchanged and
// the result checked rule-by-rule against the old config's output: same 12 rules,
// same 570 warnings, same 0 errors, across the same 173 files. If you are changing
// a rule, that is a separate change from this one.
//
// The standardization plugin set from issue #17 is layered in "pragmatically"
// (see docs/adr/010): the safe, framework-agnostic plugins are enabled, but
// noisy/subjective rules are `warn` so the gate stays green and can be tightened
// in follow-ups.
//
// Web/backend-only plugins from issue #17 are intentionally omitted (see
// docs/adr/009): jsx-a11y (RN has no DOM), eslint-plugin-security and
// eslint-plugin-n (Node/Express-specific), stylelint (no CSS).

const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const expoFlat = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');
const jsdoc = require('eslint-plugin-jsdoc');
const noSecrets = require('eslint-plugin-no-secrets');
const prettierPlugin = require('eslint-plugin-prettier');
const promise = require('eslint-plugin-promise');
const reactHooks = require('eslint-plugin-react-hooks');
const reactNativeA11y = require('eslint-plugin-react-native-a11y');
const sonarjs = require('eslint-plugin-sonarjs');
const unicorn = require('eslint-plugin-unicorn');
const globals = require('globals');

/**
 * `naming-convention`, carried across verbatim from the eslintrc (#19).
 *
 * The baseline config suggested in issue #19 produces 289 errors here, none of
 * which are real naming drift: they are SQLite column names, caliber data keys,
 * RN Navigation route names, dynamically-looked-up StyleSheet keys, and
 * function-declared React components. The carve-outs are what make the rule
 * enforce casing where it is meaningful without flagging load-bearing names.
 * Each exists for a measured reason — see the comments before relaxing one.
 */
const namingConvention = [
  'error',
  { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
  {
    selector: 'variable',
    format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
    leadingUnderscore: 'allow',
  },
  // React components are declared as functions, so the `variable` selector above
  // never reaches them; without this they fall through to `default` and every
  // component (DOPELogList, WindTable, ...) errors.
  { selector: 'function', format: ['camelCase', 'PascalCase'] },
  { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
  { selector: 'typeLike', format: ['PascalCase'] },
  { selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },
  { selector: 'import', format: ['camelCase', 'PascalCase'] },
  // snake_case: SQLite row shapes in src/types/database.types.ts mirror the schema
  // columns. PascalCase: RN Navigation route-name maps.
  { selector: 'typeProperty', format: ['camelCase', 'snake_case', 'PascalCase'] },
  // Quoted keys that are not valid identifiers ('.223 Rem' in spinDrift.ts,
  // '2xl'/'3xl' design-token scales) cannot match any format. The explicit
  // `format: null` is required: a `filter` alone only removes them from this
  // entry, after which they fall through to `default` and still error.
  {
    selector: ['objectLiteralProperty', 'typeProperty'],
    format: null,
    filter: { regex: '^[A-Za-z_$][A-Za-z0-9_$]*$', match: false },
  },
  // snake_case here covers StyleSheet keys read via dynamic lookup, e.g.
  // `styles[`button_${variant}`]` in src/components/Button.tsx — renaming those to
  // camelCase would break the lookup.
  {
    selector: 'objectLiteralProperty',
    format: ['camelCase', 'snake_case', 'PascalCase', 'UPPER_CASE'],
  },
];

module.exports = [
  {
    // eslintrc did not report unused `eslint-disable` directives; flat config does,
    // and four test files carry directives for `@typescript-eslint/no-require-imports`
    // which the test override switches off -- so they report as fatal "unused
    // directive" errors under the new format for a condition that predates it.
    // Off, to keep this migration behaviour-preserving. Turning it on and deleting
    // the four directives is a tidy-up worth doing separately.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },

  // `ignorePatterns` from the eslintrc. In flat config an `ignores`-only entry is
  // global, which is why this stands alone rather than sitting on a config object.
  {
    ignores: [
      'reports/',
      'coverage/',
      'dist/',
      'build/',
      'android/',
      'ios/',
      'node_modules/',
      // The eslintrc run was `eslint . --ext .js,.jsx,.ts,.tsx`, and eslintrc also
      // skipped dotfiles by default. Flat config has no `--ext` and no dotfile rule,
      // so without these it lints five files the old gate never saw: three
      // `scripts/*.mjs` and `.prettierrc.js`. Widening the scope may well be worth
      // doing -- the scripts are real source -- but as its own change, where the new
      // findings can be read, not buried in a format migration.
      '**/*.mjs',
      '.prettierrc.js',
    ],
  },

  // NOT `js.configs.recommended`: the eslintrc never extended `eslint:recommended`,
  // and adding it here turns on `no-case-declarations` (10) and core `no-unused-vars`
  // (2, already covered by the TypeScript rule). Enabling it is a real change to make
  // deliberately, not a side effect of changing config format.
  //
  // `eslint-config-expo/flat` already REGISTERS import, expo, @typescript-eslint,
  // react and react-hooks. Flat config rejects a redefinition rather than merging,
  // so the rules below are set directly instead of re-registering those plugins.
  //
  // One substitution is needed. Expo bundles its own older `eslint-plugin-react-hooks`,
  // which does not have `set-state-in-effect`; the eslintrc resolved this project's
  // v7 copy, which does. Three screens carry
  // `// eslint-disable-next-line react-hooks/set-state-in-effect`, and under Expo's
  // instance those name a rule that does not exist -- which ESLint reports as a hard
  // error, not a warning. Swapping the instance keeps the plugin the eslintrc
  // actually used, so the suppressions keep meaning what their authors meant.
  ...expoFlat.map((entry) =>
    entry.plugins && entry.plugins['react-hooks']
      ? { ...entry, plugins: { ...entry.plugins, 'react-hooks': reactHooks } }
      : entry
  ),

  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2021,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2021,
      },
    },
    settings: {
      react: { version: 'detect' },
      jsdoc: { mode: 'typescript' },
    },
    // Only the plugins expo's flat config does NOT already register.
    plugins: {
      prettier: prettierPlugin,
      // Standardization plugin set (issue #17). Rules are cherry-picked below
      // rather than taken from each plugin's shared config, which is how the
      // eslintrc did it and is what keeps the warning count stable.
      sonarjs,
      unicorn,
      promise,
      jsdoc,
      'no-secrets': noSecrets,
      // React Native accessibility. `jsx-a11y` targets the DOM and does not apply
      // here, but RN's own `accessible*` props are lintable (see docs/adr/009).
      'react-native-a11y': reactNativeA11y,
    },
    rules: {
      // The eslintrc extended plugin:react/recommended and
      // plugin:react-hooks/recommended. eslint-config-expo/flat already applies
      // both, using the plugin instances IT registers -- spreading this project's
      // copies on top fails, because expo's react-hooks instance does not carry
      // every rule the newer one names (react-hooks/static-components).
      // The two rules the eslintrc set explicitly are set explicitly below, which
      // is what the warning counts actually depend on.
      'prettier/prettier': 'error',

      // `eslint-config-expo/flat` enables more of `import/recommended` and of the
      // react-hooks set than the legacy `expo` config did. Off, so this migration
      // does not smuggle in 54 new findings: 47 `no-named-as-default`, 4
      // `no-named-as-default-member`, 3 `set-state-in-effect`. Each is arguably
      // worth turning on -- separately, with the findings triaged.
      'import/no-named-as-default': 'off',
      'import/no-named-as-default-member': 'off',
      'react-hooks/set-state-in-effect': 'off',

      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // --- Security (plain, non-type-aware) ---
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-secrets/no-secrets': [
        'error',
        { tolerance: 4.5, ignoreContent: ['https?://', 'data:image/'] },
      ],

      // --- Promise correctness (safe => error) ---
      'promise/no-return-wrap': 'error',
      'promise/param-names': 'error',
      'promise/no-nesting': 'warn',

      // --- Imports (TypeScript resolves modules, so no-unresolved stays off) ---
      'import/no-unresolved': 'off',
      'import/no-self-import': 'error',
      'import/no-duplicates': 'error',
      'import/no-useless-path-segments': 'error',
      // Ordering is auto-fixable but reorders existing files broadly; surfaced as a
      // warning so it does not block the gate or force a large churn diff.
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      // --- Code quality (noisy/subjective => warn) ---
      'sonarjs/cognitive-complexity': ['warn', 15],
      'sonarjs/no-duplicate-string': ['warn', { threshold: 4 }],
      'sonarjs/no-identical-functions': 'warn',
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 75, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', { max: 10 }],
      'max-depth': ['warn', 4],

      // --- Unicorn (modern JS; opinionated rules disabled) ---
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/prefer-top-level-await': 'off',
      'unicorn/prefer-module': 'off',
      // Disabled: the app mixes PascalCase components, camelCase utilities, and
      // numbered migration files (e.g. 001_initial_schema.ts). Enforcing a single
      // case here would be large, out-of-scope churn (see docs/adr/010).
      'unicorn/filename-case': 'off',

      // --- JSDoc / TSDoc (documentation; warn so it does not block) ---
      'jsdoc/require-jsdoc': [
        'warn',
        {
          // Do NOT auto-insert empty `/** */` stubs (lint-staged runs --fix).
          enableFixer: false,
          contexts: [
            'ExportNamedDeclaration > FunctionDeclaration',
            'TSInterfaceDeclaration',
            'TSTypeAliasDeclaration',
          ],
          checkConstructors: false,
        },
      ],
      'jsdoc/require-description': 'warn',
      'jsdoc/no-undefined-types': 'off',
      'jsdoc/check-tag-names': ['warn', { definedTags: ['remarks', 'public', 'internal', 'beta'] }],

      // --- React Native accessibility (see docs/adr/009) ---
      // Malformed a11y props are always wrong => error. Missing labels/hints on
      // existing components are a real backlog, so they start as warnings and get
      // ratcheted to error as screens are remediated (same approach as ADR-010).
      'react-native-a11y/has-valid-accessibility-actions': 'error',
      'react-native-a11y/has-valid-accessibility-role': 'error',
      'react-native-a11y/has-valid-accessibility-state': 'error',
      'react-native-a11y/has-valid-accessibility-value': 'error',
      'react-native-a11y/has-valid-accessibility-live-region': 'error',
      'react-native-a11y/has-valid-accessibility-ignores-invert-colors': 'error',
      'react-native-a11y/no-nested-touchables': 'error',
      // Raised from `warn` once the 65-finding backlog in `src/` was cleared -- see
      // issue #30 and ADR-010. The autofixer for `has-valid-accessibility-descriptors`
      // inserts generic placeholder labels ("Text input field"), which satisfies the
      // rule while making the app worse; treat any new finding as hand-written work.
      'react-native-a11y/has-valid-accessibility-descriptors': 'error',
      'react-native-a11y/has-accessibility-hint': 'error',
    },
  },

  // Expo registers @typescript-eslint only for `**/*.{ts,tsx,d.ts}`, so in a .js
  // file a `// eslint-disable-next-line @typescript-eslint/no-require-imports`
  // names a rule ESLint cannot resolve -- which is a hard error, not a warning.
  // `plugins/withTrimmedIosPermissions.js` carries exactly that comment. The
  // eslintrc had the plugin registered everywhere, so registering it for the
  // extensions expo leaves out restores that, with no overlap to conflict on.
  {
    files: ['**/*.{js,jsx}'],
    plugins: { '@typescript-eslint': tsPlugin },
  },

  // TypeScript rules, scoped to TypeScript.
  //
  // `eslint-config-expo/flat` registers the @typescript-eslint plugin only for
  // `**/*.{ts,tsx,d.ts}`, so referencing its rules from a config that also matches
  // .js files fails with "could not find plugin". Scoping matches what the eslintrc
  // did in practice rather than merely in principle: the old config applied these
  // to every file, and produced zero findings on a .js or .jsx file.
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/naming-convention': namingConvention,
    },
  },

  // `prettier` last, so it wins over any stylistic rule the configs above enable.
  prettierConfig,

  // The eslintrc's single `overrides` entry.
  {
    files: ['jest.setup.js', '__tests__/**/*.{js,ts,tsx}', 'security/tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.jest },
    },
    rules: {
      // Test files: relax documentation/size/duplication rules.
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'jsdoc/require-jsdoc': 'off',
      // Test fixtures are not shipped UI, and the descriptor rule's autofixer is
      // actively harmful here: because lint-staged runs `eslint --fix` on staged
      // files, it silently inserted placeholder `accessibilityLabel="Text input
      // field"` props into all 15 `<TextInput>` fixtures in TextInput.test.tsx --
      // altering the components under test and merely converting 15 "missing
      // descriptor" warnings into 15 "missing hint" warnings. This is the same
      // hazard `jsdoc/require-jsdoc` carries `enableFixer: false` for above.
      // Real accessibility remediation happens in `src/` (issue #30, which flagged
      // this exact decision); linting test fixtures for it buys nothing.
      'react-native-a11y/has-valid-accessibility-descriptors': 'off',
      'react-native-a11y/has-accessibility-hint': 'off',
    },
  },

  // `no-require-imports` off for the TypeScript test files, scoped for the same
  // reason as the block above. jest.setup.js is a .js file, where the rule is not
  // registered and so never fired in the first place.
  {
    files: ['__tests__/**/*.{ts,tsx}', 'security/tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
