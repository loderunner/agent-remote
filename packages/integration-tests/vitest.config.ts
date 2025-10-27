import path from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: [path.resolve(__dirname, './vitest.setup.ts')],
    slowTestThreshold: 20000,
  },
});
