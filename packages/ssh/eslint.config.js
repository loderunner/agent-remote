import createConfig from '@claude-remote/eslint-config';

/**
 * ESLint configuration for the SSH package
 *
 * This extends the shared config with package-specific rules
 */
export default [
  ...createConfig(),
  // Add package-specific customizations here
  // Example:
  // {
  //   rules: {
  //     '@typescript-eslint/no-explicit-any': 'error',
  //   },
  // },
];
