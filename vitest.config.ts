import { join } from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'

const alias = [
  {
    find: /^@tronweb3\/tviem$/,
    replacement: join(__dirname, './src/index.ts'),
  },
  { find: /^@tronweb3\/tviem\/(.*)/, replacement: join(__dirname, './src/$1') },
]

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['test/**/*.test.ts'],
          exclude: [...configDefaults.exclude, '**/*.e2e.test.ts'],
          typecheck: { enabled: true, include: ['test/**/*.test-d.ts'] },
        },
      },
    ],
  },
})
