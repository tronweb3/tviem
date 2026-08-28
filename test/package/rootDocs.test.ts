import { lstatSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const path = (relative: string) =>
  fileURLToPath(new URL(relative, import.meta.url))

const DOCS = ['LICENSE', 'README.md', 'THIRD-PARTY-NOTICES']

/**
 * The repo keeps two copies of each doc file: `src/` holds the published
 * ones (npm pack excludes symlinks, so they must be regular files there) and
 * the repo root holds GitHub's — which must ALSO be regular files, because
 * GitHub's license detector (licensee) does not follow symlinks and the repo
 * page would show no MIT chip. These guards pin both properties: regular
 * files at the root, byte-identical to the published copies.
 */
describe('root doc files mirror the published copies', () => {
  test.each(DOCS)('%s is a regular file', (name) => {
    expect(lstatSync(path(`../../${name}`)).isSymbolicLink()).toBe(false)
    expect(lstatSync(path(`../../${name}`)).isFile()).toBe(true)
  })

  test.each(DOCS)('%s matches its src/ copy', (name) => {
    expect(readFileSync(path(`../../${name}`), 'utf8')).toBe(
      readFileSync(path(`../../src/${name}`), 'utf8'),
    )
  })
})

/**
 * Licensee classifies a LICENSE file by whole-file similarity against known
 * license texts (~98% threshold), so appending anything sizeable — like a
 * second MIT text for third-party notices — breaks detection just as surely
 * as a symlink does. Third-party notices live in THIRD-PARTY-NOTICES instead.
 */
describe('LICENSE stays licensee-detectable', () => {
  const license = readFileSync(path('../../LICENSE'), 'utf8')

  test('contains exactly one license grant', () => {
    expect(license.match(/Permission is hereby granted/g)).toHaveLength(1)
  })

  test('keeps third-party notices out, in THIRD-PARTY-NOTICES', () => {
    expect(license).not.toMatch(/third-party/i)
    expect(readFileSync(path('../../THIRD-PARTY-NOTICES'), 'utf8')).toMatch(
      /Copyright \(c\) 2023-present weth, LLC/,
    )
  })
})
