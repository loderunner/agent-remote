import { builtinModules } from 'module';

import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
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
  // Build standalone MCP server executable
  {
    input: 'src/server.ts',
    output: {
      file: 'dist/server',
      format: 'cjs',
      sourcemap: false,
      banner: '#!/usr/bin/env node',
    },
    plugins: [
      resolve({
        preferBuiltins: true,
        exportConditions: ['node'],
        // Don't try to resolve native modules
        extensions: ['.mjs', '.js', '.json', '.ts'],
      }),
      commonjs({
        // Ignore native modules in commonjs plugin
        ignore: (id) => id.endsWith('.node'),
      }),
      typescript({
        tsconfig: './tsconfig.json',
        exclude: ['**/*.test.ts', './*.ts'],
        declaration: false,
        declarationMap: false,
      }),
      json(),
    ],
    // Only external node builtins and native modules, bundle everything else
    external: (source) => {
      return (
        builtinModules.includes(source) ||
        builtinModules.includes(source.replace(/^node:/, '')) ||
        source.endsWith('.node') ||
        source.includes('cpu-features') ||
        source.includes('sshcrypto')
      );
    },
  },
];
