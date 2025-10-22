import pluginJs from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import jestExtended from 'eslint-plugin-jest-extended';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ['**/*.{js,mjs,cjs,ts}'] },
  { ignores: ['**/dist/**/*', 'sandbox/**/*', '**/examples/**/*'] },
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            '*.config.{js,mjs,cjs,ts}',
            'packages/*/*.config.{js,mjs,cjs,ts}',
            'packages/*/*.setup.{js,mjs,cjs,ts}',
          ],
        },
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/switch-exhaustiveness-check': [
        'warn',
        { considerDefaultExhaustiveForUnions: true },
      ],
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': {
        typescript: true,
        node: true,
      },
    },
    rules: {
      'import/order': [
        'warn',
        {
          'newlines-between': 'always',
          named: true,
          alphabetize: { order: 'asc' },
        },
      ],
    },
  },
  {
    plugins: { jsdoc },
    settings: {
      jsdoc: {
        mode: 'typescript',
      },
    },
    rules: {
      'jsdoc/require-jsdoc': ['warn', { publicOnly: true }],
      'jsdoc/check-alignment': 'warn',
      'jsdoc/check-indentation': 'warn',
      'jsdoc/multiline-blocks': 'warn',
      'jsdoc/no-types': 'warn',
      'jsdoc/require-description': 'warn',
    },
  },
  {
    files: ['**/*.test.ts'],
    ...vitest.configs.recommended,
  },
  {
    files: ['**/*.test.ts'],
    ...jestExtended.configs['flat/all'],
  },
  {
    files: ['packages/ssh/src/server/**/*.{ts,js,mjs,cjs}'],
    rules: {
      'no-console': ['error', { allow: ['error'] }],
    },
  },
];
