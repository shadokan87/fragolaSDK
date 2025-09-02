#!/usr/bin/env bun
import { build } from 'bun';

await build({
  entrypoints: ['./fragola.index.ts', './store.index.ts', './agent.index.ts'],
  outdir: './dist',
  target: 'node',
  format: 'esm',
  minify: true,
  sourcemap: 'external',
  naming: '[dir]/[name].[ext]',
});

console.log('Build completed!');