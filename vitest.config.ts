import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: false,
    include: ['test/**/*.test.ts'],
  environment: 'node',
  },
  resolve: {
  // no aliases needed for build-first testing; Vitest will resolve package exports from dist
  }
})
