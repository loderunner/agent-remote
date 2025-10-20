import json from '@rollup/plugin-json';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

import packageJson from './package.json' with { type: 'json' };

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
      file: 'dist/server.cjs',
      format: 'cjs',
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
