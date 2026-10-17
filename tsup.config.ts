import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts', 'enrich/index': 'src/enrich/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: false,
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
    treeshake: true,
  },
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    platform: 'node',
    target: 'node20',
    banner: { js: '#!/usr/bin/env node' },
    // Reuse dist/index.js and dist/enrich/index.js instead of bundling copies.
    external: ['./index.js', './enrich/index.js'],
    sourcemap: false,
    clean: false,
  },
]);
