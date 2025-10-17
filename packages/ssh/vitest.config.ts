import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: [path.resolve(__dirname, './vitest.setup.ts')],
  },
});
