# @claude-remote/eslint-config

Shared ESLint configuration for Claude Remote projects.

## Usage

### Basic Usage

In your project root or package, create an `eslint.config.js`:

```js
import createConfig from '@claude-remote/eslint-config';

export default createConfig();
```

### Customization

You can extend or override the shared configuration by spreading additional configs:

```js
import createConfig from '@claude-remote/eslint-config';

export default [
  ...createConfig(),
  {
    // Add your custom rules here
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];
```

### Options

The `createConfig` function accepts an optional configuration object:

- `additionalIgnores`: Array of additional glob patterns to ignore
- `parserOptions`: Additional parser options to merge with the default configuration

Example:

```js
import createConfig from '@claude-remote/eslint-config';

export default createConfig({
  additionalIgnores: ['**/*.generated.ts'],
  parserOptions: {
    // Additional parser options
  },
});
```

## What's Included

This configuration includes:

- TypeScript ESLint recommended type-checked rules
- Import ordering and organization
- JSDoc documentation requirements
- Vitest and Jest Extended support for test files
- Consistent code style rules

## Package Dependencies

This package requires the following peer dependencies to be installed in your project:

- `@eslint/js`
- `@vitest/eslint-plugin`
- `eslint`
- `eslint-import-resolver-typescript`
- `eslint-plugin-import`
- `eslint-plugin-jest-extended`
- `eslint-plugin-jsdoc`
- `globals`
- `typescript-eslint`
