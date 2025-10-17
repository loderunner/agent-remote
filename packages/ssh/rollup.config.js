import json from '@rollup/plugin-json';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

import packageJson from './package.json' with { type: 'json' };

/** @type {import('rollup').RollupOptions[]} */
export default [
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
];
