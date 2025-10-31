import path from 'path';

/**
 * Simple esbuild plugin to resolve @src/* to ./src/*
 */
export function aliasSrcPlugin() {
  return {
    name: 'alias-src',
    setup(build) {
      build.onResolve({ filter: /^@src\// }, args => {
        // Remove @src/ and resolve to ./src/...
        const relPath = args.path.replace(/^@src\//, './src/');
        return { path: path.resolve(process.cwd(), relPath) };
      });
    },
  };
}
