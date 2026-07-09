import { join } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    alias: [
      {
        find: /^@tronweb3\/omni$/,
        replacement: join(__dirname, './src/index.ts'),
      },
      {
        find: /^@tronweb3\/omni\/(.*)/,
        replacement: join(__dirname, './src/$1'),
      },
    ],
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    typecheck: {
      include: ['src/**/*.test-d.ts'],
    },
  },
})
