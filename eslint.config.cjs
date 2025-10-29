// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format

const globals = require('globals');
const tsParser = require('@typescript-eslint/parser');
const tseslint = require('@typescript-eslint/eslint-plugin');
const noHooksRule = require('./eslint/rules/no-hooks-in-modifiers.cjs');
const noProviderLeakageRule = require('./eslint/rules/no-provider-leakage.cjs');
const noNaiveDateRule = require('./eslint/rules/no-naive-date.cjs');
const noAccountUnsafeMetadataRule = require('./eslint/rules/no-account-unsafe-metadata.cjs');
const noUnsafeTenancyOverrideRule = require('./eslint/rules/no-unsafe-tenancy-override.cjs');

module.exports = [
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        ...globals.es2022,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      oods: {
        rules: {
          'no-hooks-in-modifiers': noHooksRule,
          'no-provider-leakage': noProviderLeakageRule,
          'no-naive-date': noNaiveDateRule,
          'no-account-unsafe-metadata': noAccountUnsafeMetadataRule,
          'no-unsafe-tenancy-override': noUnsafeTenancyOverrideRule,
        },
      },
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      'oods/no-account-unsafe-metadata': 'error',
      'oods/no-unsafe-tenancy-override': 'error',
    },
  },
  {
    files: ['**/*.modifier.ts', '**/*.modifier.tsx'],
    rules: {
      'oods/no-hooks-in-modifiers': 'error',
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'apps/**/*.ts', 'apps/**/*.tsx'],
    ignores: [
      'src/integrations/billing/**',
      'tests/integrations/billing/**',
      'fixtures/billing/**',
      'domains/saas-billing/**',
    ],
    rules: {
      'oods/no-provider-leakage': 'error',
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'apps/**/*.ts', 'apps/**/*.tsx'],
    ignores: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx', '**/*.spec.tsx'],
    rules: {
      'oods/no-naive-date': 'error',
    },
  },
];
