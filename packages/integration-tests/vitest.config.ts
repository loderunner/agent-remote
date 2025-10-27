import path from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@agent-remote/ssh': path.resolve(__dirname, '../ssh/src/lib/index.ts'),
    },
  },
  test: {
    globals: true,
    setupFiles: [path.resolve(__dirname, './vitest.setup.ts')],
    slowTestThreshold: 20000,
  },
});
