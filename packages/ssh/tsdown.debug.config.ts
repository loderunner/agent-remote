import { Options, defineConfig } from 'tsdown';

export const serverTarget: Options = {
  entry: 'src/server/server.ts',
  format: 'esm',
  banner: `#!/usr/bin/env node`,
  outDir: 'dist',
  noExternal: ['@agent-remote/core'],
  plugins: [
    {
      name: 'log',
      buildStart: async () => {
        console.log(`${new Date().toISOString()} - buildStart`);
      },
      buildEnd: async () => {
        console.log(`${new Date().toISOString()} - buildEnd`);
      },
    },
  ],
  hooks: {
    'build:before': async () => {
      console.log(`${new Date().toISOString()} - build:before`);
    },
    'build:prepare': async () => {
      console.log(`${new Date().toISOString()} - build:prepare`);
    },
    'build:done': async () => {
      console.log(`${new Date().toISOString()} - build:done`);
    },
  },
  dts: false,
  shims: false,
  clean: false,
};

export default defineConfig([serverTarget]);
