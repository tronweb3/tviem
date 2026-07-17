import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import * as accounts from '../../src/accounts/index.js'
import * as actions from '../../src/actions/index.js'
import * as chains from '../../src/chains/index.js'
import * as root from '../../src/index.js'
import * as utils from '../../src/utils/index.js'

const pkg = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../package.json', import.meta.url)),
    'utf8',
  ),
) as {
  exports: Record<string, { types: string; import: string; default: string } | string>
  typesVersions: { '*': Record<string, string[]> }
}

/**
 * Freeze guard for the published surface. The structural asserts pin the
 * package.json `exports` map (subpath list + condition wiring); the snapshot
 * pins the exact set of names exported from root and each subpath barrel, so an
 * accidental add/remove (e.g. leaking an internal helper) fails CI review.
 */
describe('package exports surface (freeze guard)', () => {
  test('exports map is exactly the public entrypoints, each with types/import/default', () => {
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
      expect(entry.types).toMatch(/^\.\/src\/_types\/.*\.d\.ts$/)
      expect(entry.import).toMatch(/^\.\/src\/_esm\/.*\.js$/)
      expect(entry.default).toMatch(/^\.\/src\/_cjs\/.*\.js$/)
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
