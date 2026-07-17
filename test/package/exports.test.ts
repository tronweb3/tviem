import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import * as accounts from '../../src/accounts/index.js'
import * as actions from '../../src/actions/index.js'
import * as chains from '../../src/chains/index.js'
import * as root from '../../src/index.js'
import * as utils from '../../src/utils/index.js'

const read = (relative: string) =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8'),
  )

// The published package is `src/` (viem-style): `src/package.json` is the
// manifest, paths are relative to it (no `src/` prefix), and the repo-root
// package.json is a private dev manifest that must never be published.
const rootPkg = read('../../package.json') as { private?: boolean }
const pkg = read('../../src/package.json') as {
  exports: Record<
    string,
    { types: string; import: string; default: string } | string
  >
  typesVersions: { '*': Record<string, string[]> }
}

/**
 * Freeze guard for the published surface. The structural asserts pin the
 * publish manifest's `exports` map (subpath list + condition wiring); the
 * snapshot pins the exact set of names exported from root and each subpath
 * barrel, so an accidental add/remove (e.g. leaking an internal helper) fails.
 */
describe('package exports surface (freeze guard)', () => {
  test('repo-root package.json is private (only src/ is published)', () => {
    expect(rootPkg.private).toBe(true)
  })

  test('publish manifest exports the public entrypoints with types/import/default', () => {
    expect(Object.keys(pkg.exports).sort()).toEqual([
      '.',
      './accounts',
      './actions',
      './chains',
      './package.json',
      './utils',
    ])
    for (const sub of ['.', './accounts', './actions', './chains', './utils']) {
      const entry = pkg.exports[sub] as {
        types: string
        import: string
        default: string
      }
      expect(entry.types).toMatch(/^\.\/_types\/.*\.d\.ts$/)
      expect(entry.import).toMatch(/^\.\/_esm\/.*\.js$/)
      expect(entry.default).toMatch(/^\.\/_cjs\/.*\.js$/)
    }
    expect(pkg.exports['./package.json']).toBe('./package.json')
  })

  test('typesVersions mirrors the four typed subpaths', () => {
    expect(Object.keys(pkg.typesVersions['*']).sort()).toEqual([
      'accounts',
      'actions',
      'chains',
      'utils',
    ])
  })

  test('root + subpath export names are frozen', () => {
    const names = (mod: object) => Object.keys(mod).sort()
    expect({
      root: names(root),
      accounts: names(accounts),
      actions: names(actions),
      chains: names(chains),
      utils: names(utils),
    }).toMatchSnapshot()
  })
})
