# @claude-remote/eslint-config

Shared ESLint configuration for Claude Remote projects.

## Usage

### Basic Usage

In your project root or package, create an `eslint.config.js`:

```js
import config from '@claude-remote/eslint-config';

export default config;
```

### Customization

You can extend or override the shared configuration by spreading it into an
array:

```js
import config from '@claude-remote/eslint-config';

export default [
  ...config,
  {
    // Add your custom rules here
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];
```

### Adding Ignores

```js
import config from '@claude-remote/eslint-config';

export default [
  ...config,
  {
    ignores: ['**/*.generated.ts'],
  },
];
```

## What's Included

This configuration includes:

- TypeScript ESLint recommended type-checked rules
- Import ordering and organization
- JSDoc documentation requirements
- Vitest and Jest Extended support for test files
- Consistent code style rules

## Package Dependencies

This package requires the following peer dependencies to be installed in your
project:

- `@eslint/js`
- `@vitest/eslint-plugin`
- `eslint`
- `eslint-import-resolver-typescript`
- `eslint-plugin-import`
- `eslint-plugin-jest-extended`
- `eslint-plugin-jsdoc`
- `globals`
- `typescript-eslint`
