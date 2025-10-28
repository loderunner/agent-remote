import { defineConfig } from 'vitest/config';

const test = {
  globals: true,
};

export default defineConfig({
  test: {
    slowTestThreshold: 20000,
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
          name: 'e2e',
          include: ['src/**/*.e2e.test.ts'],
        },
      },
    ],
  },
});
