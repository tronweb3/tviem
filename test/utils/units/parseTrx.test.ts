import { expect, test } from 'vitest'

import { InvalidDecimalNumberError } from '../../../src/errors/unit.js'
import { formatTrx } from '../../../src/utils/units/formatTrx.js'
import { parseTrx } from '../../../src/utils/units/parseTrx.js'

test('converts trx to sun', () => {
  expect(parseTrx('6942069420.123456')).toMatchInlineSnapshot(
    '6942069420123456n',
  )
  expect(parseTrx('6942069420')).toMatchInlineSnapshot('6942069420000000n')
  expect(parseTrx('1')).toMatchInlineSnapshot('1000000n')
  expect(parseTrx('0.5')).toMatchInlineSnapshot('500000n')
  expect(parseTrx('0.1')).toMatchInlineSnapshot('100000n')
  expect(parseTrx('0.01')).toMatchInlineSnapshot('10000n')
  expect(parseTrx('0.001')).toMatchInlineSnapshot('1000n')
  expect(parseTrx('0.0001')).toMatchInlineSnapshot('100n')
  expect(parseTrx('0.00001')).toMatchInlineSnapshot('10n')
  expect(parseTrx('0.000001')).toMatchInlineSnapshot('1n')
  expect(parseTrx('-6942069420.123456')).toMatchInlineSnapshot(
    '-6942069420123456n',
  )
  expect(parseTrx('-6942069420')).toMatchInlineSnapshot('-6942069420000000n')
  expect(parseTrx('-1')).toMatchInlineSnapshot('-1000000n')
  expect(parseTrx('-0.5')).toMatchInlineSnapshot('-500000n')
  expect(parseTrx('-0.1')).toMatchInlineSnapshot('-100000n')
  expect(parseTrx('-0.0001')).toMatchInlineSnapshot('-100n')
  expect(parseTrx('-0.00001')).toMatchInlineSnapshot('-10n')
  expect(parseTrx('-0.000001')).toMatchInlineSnapshot('-1n')
})

test('converts to rounded sun', () => {
  expect(parseTrx('0.0000001')).toMatchInlineSnapshot('0n')
  expect(parseTrx('0.00000059')).toMatchInlineSnapshot('1n')
  expect(parseTrx('1.00000059')).toMatchInlineSnapshot('1000001n')
  expect(parseTrx('69.59000059')).toMatchInlineSnapshot('69590001n')
  expect(parseTrx('1.23456791234522')).toMatchInlineSnapshot('1234568n')
  expect(parseTrx('-0.0000001')).toMatchInlineSnapshot('0n')
  expect(parseTrx('-0.00000059')).toMatchInlineSnapshot('-1n')
  expect(parseTrx('-1.00000059')).toMatchInlineSnapshot('-1000001n')
  expect(parseTrx('-69.59000059')).toMatchInlineSnapshot('-69590001n')
  expect(parseTrx('-1.23456791234522')).toMatchInlineSnapshot('-1234568n')
})

// .claude/docs/02-v0.1a-任务清单.md §2.4 units vectors, asserted verbatim.
test('§2.4 vectors', () => {
  expect(parseTrx('1') === 1000000n).toBe(true)
  expect(parseTrx('0.000001') === 1n).toBe(true)
})

test('rejects non-decimal input with InvalidDecimalNumberError', () => {
  expect(() => parseTrx('1e6')).toThrow(InvalidDecimalNumberError)
  expect(() => parseTrx('0x10')).toThrow(InvalidDecimalNumberError)
})

test('large-value precision (pure bigint, no float loss)', () => {
  const trx64 = 18446744073709551616n // 2^64
  expect(parseTrx(trx64.toString())).toBe(trx64 * 10n ** 6n)

  const trx256 =
    115792089237316195423570985008687907853269984665640564039457584007913129639936n // 2^256
  expect(parseTrx(trx256.toString())).toBe(trx256 * 10n ** 6n)
})

test('round-trip: formatTrx(parseTrx(x)) === normalized x', () => {
  const vectors: [string, string][] = [
    ['1', '1'],
    ['0.5', '0.5'],
    ['0.000001', '0.000001'],
    ['6942069420.123456', '6942069420.123456'],
    ['1.100000', '1.1'],
    ['-1', '-1'],
    ['-0.5', '-0.5'],
    ['-6942069420.123456', '-6942069420.123456'],
  ]
  for (const [input, normalized] of vectors)
    expect(formatTrx(parseTrx(input))).toBe(normalized)
})
