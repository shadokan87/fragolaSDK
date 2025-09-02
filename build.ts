#!/usr/bin/env bun
import { build } from 'bun';
import { spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(spawn);

// Build JavaScript files with Bun
await build({
  entrypoints: ['./fragola.index.ts', './store.index.ts', './agent.index.ts'],
  outdir: './dist',
  target: 'node',
  format: 'esm',
  minify: true,
  sourcemap: 'external',
  naming: '[dir]/[name].[ext]',
});

// Generate TypeScript declaration files
console.log('Generating TypeScript declaration files...');
const tscProcess = spawn('npx', ['tsc', '--project', 'tsconfig.build.json'], { stdio: 'inherit' });

await new Promise((resolve, reject) => {
  tscProcess.on('close', (code) => {
    if (code === 0) {
      console.log('TypeScript declaration files generated successfully!');
      resolve(code);
    } else {
      reject(new Error(`TypeScript compilation failed with code ${code}`));
    }
  });
});

console.log('Build completed!');