import fs from 'node:fs/promises';
import { basename } from 'node:path';

import json from '@rollup/plugin-json';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

import packageJson from './package.json' with { type: 'json' };

function chmod({ mode }) {
  /** @type {import('rollup').Plugin} */
  const plugin = {
    name: 'chmod',
    async writeBundle(options, bundle) {
      return Promise.all(
        Object.entries(bundle).map(async ([filename, output]) => {
          if (
            output.type === 'chunk' &&
            output.isEntry &&
            filename === basename(options.file)
          ) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return fs.chmod(options.file, mode);
          }
        }),
      );
    },
  };
  return plugin;
}

/** @type {import('rollup').RollupOptions[]} */
export default [
  // Build main library
  {
    input: 'src/lib/index.ts',
    output: [
      {
        file: packageJson.main,
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: packageJson.module,
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        exclude: ['**/*.test.ts', './*.ts'],
        declaration: false,
        declarationMap: false,
      }),
    ],
    external: (source) => {
      return (
        !source.startsWith('.') &&
        !source.startsWith('/') &&
        !source.startsWith('~/')
      );
    },
  },
  {
    input: 'src/lib/index.ts',
    output: { file: packageJson.types, format: 'es' },
    plugins: [dts({ compilerOptions: { removeComments: true } })],
  },
  // Build standalone MCP server executable
  {
    input: 'src/server/server.ts',
    output: {
      file: 'dist/remote-ssh-mcp',
      format: 'esm',
      sourcemap: false,
      banner: '#!/usr/bin/env node',
    },
    plugins: [
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        exclude: ['**/*.test.ts', './*.ts'],
        declaration: false,
        declarationMap: false,
        sourceMap: false,
      }),
      chmod({ mode: 0o755 }),
    ],
    external: (source) => {
      return (
        !source.startsWith('.') &&
        !source.startsWith('/') &&
        !source.startsWith('~/')
      );
    },
  },
];
