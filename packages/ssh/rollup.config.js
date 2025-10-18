import json from '@rollup/plugin-json';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

import packageJson from './package.json' with { type: 'json' };

/** @type {import('rollup').RollupOptions[]} */
export default [
  // Build main library
  {
    input: 'src/index.ts',
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
      typescript({
        tsconfig: './tsconfig.json',
        exclude: ['**/*.test.ts', './*.ts'],
        declaration: false,
        declarationMap: false,
      }),
      json(),
    ],
    // External all dependencies
    external: (source) => {
      return !source.startsWith('.') && !source.startsWith('/');
    },
  },
  {
    input: 'src/index.ts',
    output: { file: packageJson.types, format: 'es' },
    plugins: [dts({ compilerOptions: { removeComments: true } })],
  },
  // Build MCP server
  {
    input: 'src/server.ts',
    output: [
      {
        file: 'dist/cjs/server.cjs',
        format: 'cjs',
        sourcemap: true,
        banner: '#!/usr/bin/env node',
      },
      {
        file: 'dist/esm/server.mjs',
        format: 'esm',
        sourcemap: true,
        banner: '#!/usr/bin/env node',
      },
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        exclude: ['**/*.test.ts', './*.ts'],
        declaration: false,
        declarationMap: false,
      }),
      json(),
    ],
    // External all dependencies
    external: (source) => {
      return !source.startsWith('.') && !source.startsWith('/');
    },
  },
  {
    input: 'src/server.ts',
    output: { file: 'dist/server.d.ts', format: 'es' },
    plugins: [dts({ compilerOptions: { removeComments: true } })],
  },
];
