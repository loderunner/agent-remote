import fs from 'node:fs/promises';
import path from 'node:path';

import type { Options } from 'tsdown';
import { defineConfig } from 'tsdown';

export const esmTarget: Options = {
  entry: 'src/lib/index.ts',
  format: 'esm',
  outDir: 'dist/esm',
  unbundle: true,
  noExternal: ['@agent-remote/core'],
  dts: false,
  shims: false,
  clean: true,
  sourcemap: true,
};

export const cjsTarget: Options = {
  entry: 'src/lib/index.ts',
  format: 'cjs',
  outDir: 'dist/cjs',
  unbundle: true,
  noExternal: ['@agent-remote/core'],
  dts: false,
  shims: false,
  clean: true,
  sourcemap: true,
};

export const serverTarget: Options = {
  entry: 'src/server/server.ts',
  format: 'esm',
  banner: `#!/usr/bin/env node`,
  outDir: 'dist',
  noExternal: ['@agent-remote/core'],
  plugins: [
    {
      name: 'chmod',
      writeBundle: async (options, bundle) => {
        for (const [_, output] of Object.entries(bundle)) {
          if (output.type === 'chunk' && output.isEntry) {
            await fs.chmod(path.join(options.dir!, output.fileName), 0o755);
          }
        }
      },
    },
  ],
  dts: false,
  shims: false,
  clean: false,
};

export const typeDeclarationsTarget: Options = {
  entry: 'src/lib/index.ts',
  outDir: 'dist',
  dts: {
    emitDtsOnly: true,
    build: true,
  },
};

export default defineConfig([
  // Build library as ESM
  esmTarget,
  // Build library as CJS
  cjsTarget,
  // Build server executable
  serverTarget,
  // Build type declarations
  typeDeclarationsTarget,
]);
