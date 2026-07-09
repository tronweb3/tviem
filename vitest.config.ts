import { join } from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'

const alias = [
  { find: /^@tronweb3\/omni$/, replacement: join(__dirname, './src/index.ts') },
  { find: /^@tronweb3\/omni\/(.*)/, replacement: join(__dirname, './src/$1') },
]

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
          exclude: [...configDefaults.exclude, '**/*.e2e.test.ts'],
          typecheck: { enabled: true, include: ['src/**/*.test-d.ts'] },
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'e2e',
          include: ['src/**/*.e2e.test.ts'],
        },
      },
    ],
  },
})
