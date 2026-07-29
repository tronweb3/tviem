// Development linker: symlinks each subpath export's dist file (`src/_esm|_cjs|_types/**`)
// straight to its `index.ts` source, so `vitest` / the IDE resolve `@tronweb3/tviem/*` to
// source without a build step. Run via `pnpm preconstruct`.
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

console.log('Setting up packages for development.')

const root = resolve(import.meta.dirname, '..')
const packageJson = JSON.parse(
  readFileSync(resolve(root, 'package.json'), 'utf-8'),
)

console.log(`${packageJson.name} — ${root}`)

// Empty dist directories.
for (const dirName of ['_cjs', '_esm', '_types']) {
  const dist = resolve(root, 'src', dirName)
  let files = []
  try {
    files = readdirSync(dist)
  } catch {
    mkdirSync(dist, { recursive: true })
  }
  for (const file of files)
    rmSync(join(dist, file), { recursive: true, force: true })
}

// Link exports to dist locations.
for (const [key, exports] of Object.entries(packageJson.exports)) {
  if (/package\.json$/.test(key)) continue

  const entries =
    typeof exports === 'string'
      ? [
          ['default', exports],
          ['types', exports.replace('.js', '.d.ts')],
        ]
      : Object.entries(exports)

  for (const [, value] of entries) {
    const srcDir = resolve(root, dirname(value).replace(/_types|_esm|_cjs/, ''))
    const srcFilePath = resolve(srcDir, 'index.ts')

    const distDir = resolve(root, dirname(value))
    const distFilePath = resolve(distDir, basename(value))

    mkdirSync(distDir, { recursive: true })
    try {
      symlinkSync(srcFilePath, distFilePath, 'file')
    } catch {}
  }
}

console.log('Done.')
