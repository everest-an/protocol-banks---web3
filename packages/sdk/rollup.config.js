import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';
import dts from 'rollup-plugin-dts';

const production = !process.env.ROLLUP_WATCH;

// Shared plugins
const plugins = [
  resolve({ browser: true }),
  commonjs(),
  json(),
  typescript({ tsconfig: './tsconfig.json' }),
  production && terser({
    compress: {
      drop_console: production,
      drop_debugger: production,
    },
  }),
].filter(Boolean);

export default [
  // Main SDK bundle
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true,
      },
      {
        file: 'dist/index.umd.js',
        format: 'umd',
        name: 'ProtocolBanks',
        sourcemap: true,
        globals: {
          ethers: 'ethers',
        },
      },
    ],
    plugins,
    external: ['ethers'],
  },
  // Embed script (standalone, no external deps)
  {
    input: 'src/embed/index.ts',
    output: [
      {
        file: 'dist/embed.js',
        format: 'iife',
        name: 'PBCheckout',
        sourcemap: true,
      },
      {
        file: 'dist/embed.esm.js',
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      json(),
      typescript({ tsconfig: './tsconfig.json' }),
      production && terser({
        compress: {
          drop_console: production,
          drop_debugger: production,
        },
      }),
    ].filter(Boolean),
  },
  // Type declarations
  {
    input: 'dist/index.d.ts',
    output: [{ file: 'dist/index.d.ts', format: 'esm' }],
    plugins: [dts()],
    external: [/\.css$/],
  },
];
