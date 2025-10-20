import path from 'path';

import { defineConfig } from 'vitest/config';

const test = {
  globals: true,
  setupFiles: [path.resolve(__dirname, './vitest.setup.ts')],
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          ...test,
          name: 'unit',
          include: ['src/**/*.unit.test.ts'],
        },
      },
      {
        test: {
          ...test,
          name: 'integration',
          include: ['src/**/*.integration.test.ts', 'tests/**/*.integration.test.ts'],
        },
      },
      {
        test: {
          ...test,
          name: 'e2e',
          include: ['src/**/*.e2e.test.ts'],
        },
      },
    ],
  },
});
