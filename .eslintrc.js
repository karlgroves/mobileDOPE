// Legacy ESLint config (eslintrc) for the Mobile DOPE app.
//
// This is a REACT NATIVE / Expo project. It deliberately stays on the legacy
// `.eslintrc` format (run via `ESLINT_USE_FLAT_CONFIG=false`) because
// `eslint-config-expo` is consumed here and the Expo toolchain assumes it
// (see docs/adr/007). The standardization plugin set from issue #17 is layered
// in "pragmatically" (see docs/adr/010): the safe, framework-agnostic plugins
// are enabled, but noisy/subjective rules are `warn` so the gate stays green and
// can be tightened in follow-ups.
//
// Web/backend-only plugins from issue #17 are intentionally omitted (see
// docs/adr/009): jsx-a11y (RN has no DOM), eslint-plugin-security and
// eslint-plugin-n (Node/Express-specific), stylelint (no CSS).
module.exports = {
  root: true,
  ignorePatterns: ['reports/', 'coverage/', 'dist/', 'build/', 'android/', 'ios/'],
  extends: [
    'expo',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'prettier',
    // Standardization plugin set (issue #17). Rules are cherry-picked below
    // rather than via each plugin's shared config to stay compatible with the
    // legacy eslintrc format.
    'sonarjs',
    'unicorn',
    'promise',
    'jsdoc',
    'no-secrets',
    'import',
    // React Native accessibility. `jsx-a11y` targets the DOM and does not apply
    // here, but RN's own `accessible*` props are lintable (see docs/adr/009).
    'react-native-a11y',
  ],
  settings: {
    react: {
      version: 'detect',
    },
    jsdoc: {
      mode: 'typescript',
    },
  },
  rules: {
    'prettier/prettier': 'error',
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

    // --- Naming conventions (issue #19) ---
    // The baseline config suggested in issue #19 produces 289 errors here, none of
    // which are real naming drift: they are SQLite column names, caliber data keys,
    // RN Navigation route names, dynamically-looked-up StyleSheet keys, and
    // function-declared React components. The carve-outs below are what make the
    // rule enforce casing where it is meaningful without flagging load-bearing
    // names. Each exists for a measured reason — see the comments before relaxing.
    '@typescript-eslint/naming-convention': [
      'error',
      { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        leadingUnderscore: 'allow',
      },
      // React components are declared as functions, so the `variable` selector
      // above never reaches them; without this they fall through to `default`
      // and every component (DOPELogList, WindTable, ...) errors.
      { selector: 'function', format: ['camelCase', 'PascalCase'] },
      { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
      { selector: 'typeLike', format: ['PascalCase'] },
      { selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },
      { selector: 'import', format: ['camelCase', 'PascalCase'] },
      // snake_case: SQLite row shapes in src/types/database.types.ts mirror the
      // schema columns. PascalCase: RN Navigation route-name maps.
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
      // `styles[\`button_${variant}\`]` in src/components/Button.tsx — renaming
      // those to camelCase would break the lookup.
      {
        selector: 'objectLiteralProperty',
        format: ['camelCase', 'snake_case', 'PascalCase', 'UPPER_CASE'],
      },
    ],

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
    'react-native-a11y/has-valid-accessibility-descriptors': 'warn',
    'react-native-a11y/has-accessibility-hint': 'warn',
  },
  overrides: [
    {
      files: ['jest.setup.js', '__tests__/**/*.{js,ts,tsx}'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
        // Test files: relax documentation/size/duplication rules.
        'max-lines': 'off',
        'max-lines-per-function': 'off',
        'sonarjs/no-duplicate-string': 'off',
        'sonarjs/cognitive-complexity': 'off',
        'jsdoc/require-jsdoc': 'off',
      },
    },
  ],
};
