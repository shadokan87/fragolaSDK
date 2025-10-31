#!/usr/bin/env bun
import { build } from 'esbuild';
import { aliasSrcPlugin } from './esbuild.aliasSrcPlugin.js';
import { spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(spawn);

// Build JavaScript files with esbuild
await build({
  entryPoints: [
    './fragola.index.ts', 
    './store.index.ts', 
    './agent.index.ts',
    './event.index.ts',
    './hook.index.ts',
    './hook.presets.index.ts',
    './src/**/*.ts'
  ],
  outdir: './dist',
  platform: 'node',
  target: 'node18',
  format: 'esm',
  minify: true,
  sourcemap: true,
  sourcesContent: true,
  bundle: false,
  metafile: true,
  plugins: [aliasSrcPlugin()],
}).catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
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