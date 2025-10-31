import path from 'path';

/**
 * Simple esbuild plugin to resolve @src/* to ./src/*
 */
import fs from 'fs';
export function aliasSrcPlugin() {
  return {
    name: 'alias-src',
    setup(build) {
      build.onResolve({ filter: /^@src\// }, args => {
        let relPath = args.path.replace(/^@src\//, './src/');
        let absPath = path.resolve(process.cwd(), relPath);
        // If no extension and file doesn't exist, try .ts
        if (!path.extname(absPath) && !fs.existsSync(absPath) && fs.existsSync(absPath + '.ts')) {
          absPath += '.ts';
        }
        return { path: absPath };
      });
    },
  };
}
