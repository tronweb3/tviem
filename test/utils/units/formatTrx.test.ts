import { expect, test } from 'vitest'

import { formatTrx } from '../../../src/utils/units/formatTrx.js'
import { parseTrx } from '../../../src/utils/units/parseTrx.js'

test('converts sun to trx', () => {
  expect(formatTrx(6942069420123456n)).toMatchInlineSnapshot(
    '"6942069420.123456"',
  )
  expect(formatTrx(6942069420000000n)).toMatchInlineSnapshot('"6942069420"')
  expect(formatTrx(1000000000000n)).toMatchInlineSnapshot('"1000000"')
  expect(formatTrx(100000000000n)).toMatchInlineSnapshot('"100000"')
  expect(formatTrx(10000000000n)).toMatchInlineSnapshot('"10000"')
  expect(formatTrx(1000000000n)).toMatchInlineSnapshot('"1000"')
  expect(formatTrx(100000000n)).toMatchInlineSnapshot('"100"')
  expect(formatTrx(10000000n)).toMatchInlineSnapshot('"10"')
  expect(formatTrx(1000000n)).toMatchInlineSnapshot('"1"')
  expect(formatTrx(500000n)).toMatchInlineSnapshot('"0.5"')
  expect(formatTrx(100000n)).toMatchInlineSnapshot('"0.1"')
  expect(formatTrx(10000n)).toMatchInlineSnapshot('"0.01"')
  expect(formatTrx(1000n)).toMatchInlineSnapshot('"0.001"')
  expect(formatTrx(100n)).toMatchInlineSnapshot('"0.0001"')
  expect(formatTrx(10n)).toMatchInlineSnapshot('"0.00001"')
  expect(formatTrx(1n)).toMatchInlineSnapshot('"0.000001"')
  expect(formatTrx(0n)).toMatchInlineSnapshot('"0"')
  expect(formatTrx(-6942069420123456n)).toMatchInlineSnapshot(
    '"-6942069420.123456"',
  )
  expect(formatTrx(-6942069420000000n)).toMatchInlineSnapshot('"-6942069420"')
  expect(formatTrx(-1000000n)).toMatchInlineSnapshot('"-1"')
  expect(formatTrx(-500000n)).toMatchInlineSnapshot('"-0.5"')
  expect(formatTrx(-100000n)).toMatchInlineSnapshot('"-0.1"')
  expect(formatTrx(-100n)).toMatchInlineSnapshot('"-0.0001"')
  expect(formatTrx(-10n)).toMatchInlineSnapshot('"-0.00001"')
  expect(formatTrx(-1n)).toMatchInlineSnapshot('"-0.000001"')
})

// .claude/docs/02-v0.1a-任务清单.md §2.4 units vectors, asserted verbatim.
test('§2.4 vectors', () => {
  expect(formatTrx(1000000n) === '1').toBe(true)
  expect(formatTrx(1n) === '0.000001').toBe(true)
})

test('large-value precision (pure bigint, no float loss)', () => {
  const trx64 = 18446744073709551616n // 2^64
  expect(formatTrx(trx64 * 10n ** 6n)).toBe(trx64.toString())

  const trx256 =
    115792089237316195423570985008687907853269984665640564039457584007913129639936n // 2^256
  expect(formatTrx(trx256 * 10n ** 6n)).toBe(trx256.toString())
})

test('round-trip: parseTrx(formatTrx(v)) === v (integer sun)', () => {
  const vectors = [
    0n,
    1n,
    500000n,
    1000000n,
    6942069420123456n,
    -1n,
    -500000n,
    -6942069420123456n,
    18446744073709551616n, // 2^64
    115792089237316195423570985008687907853269984665640564039457584007913129639936n, // 2^256
  ]
  for (const v of vectors) expect(parseTrx(formatTrx(v))).toBe(v)
})
