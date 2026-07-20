import { expect, test } from 'vitest'

import { InvalidDecimalNumberError } from '../../../src/errors/unit.js'
import { formatUnits } from '../../../src/utils/units/formatUnits.js'
import { parseUnits } from '../../../src/utils/units/parseUnits.js'

test('converts number to unit of a given length', () => {
  expect(parseUnits('69', 1)).toMatchInlineSnapshot('690n')
  expect(parseUnits('13', 5)).toMatchInlineSnapshot('1300000n')
  expect(parseUnits('420', 10)).toMatchInlineSnapshot('4200000000000n')
  expect(parseUnits('20', 9)).toMatchInlineSnapshot('20000000000n')
  expect(parseUnits('40', 18)).toMatchInlineSnapshot('40000000000000000000n')
  expect(parseUnits('1.2345', 4)).toMatchInlineSnapshot('12345n')
  expect(parseUnits('1.0045', 4)).toMatchInlineSnapshot('10045n')
  expect(parseUnits('1.2345000', 4)).toMatchInlineSnapshot('12345n')
  expect(parseUnits('6942069420.12345678912345', 18)).toMatchInlineSnapshot(
    '6942069420123456789123450000n',
  )
  expect(parseUnits('6942069420.00045678912345', 18)).toMatchInlineSnapshot(
    '6942069420000456789123450000n',
  )
  expect(
    parseUnits('6942123123123069420.1234544444678912345', 50),
  ).toMatchInlineSnapshot(
    '694212312312306942012345444446789123450000000000000000000000000000000n',
  )
  expect(parseUnits('-69', 1)).toMatchInlineSnapshot('-690n')
  expect(parseUnits('-1.2345', 4)).toMatchInlineSnapshot('-12345n')
  expect(parseUnits('-6942069420.12345678912345', 18)).toMatchInlineSnapshot(
    '-6942069420123456789123450000n',
  )
  expect(
    parseUnits('-6942123123123069420.1234544444678912345', 50),
  ).toMatchInlineSnapshot(
    '-694212312312306942012345444446789123450000000000000000000000000000000n',
  )
})

test('decimals === 0', () => {
  expect(
    parseUnits('69.2352112312312451512412341231', 0),
  ).toMatchInlineSnapshot('69n')
  expect(
    parseUnits('69.5952141234124125231523412312', 0),
  ).toMatchInlineSnapshot('70n')
  expect(parseUnits('12301000000000000020000', 0)).toMatchInlineSnapshot(
    '12301000000000000020000n',
  )
  expect(parseUnits('12301000000000000020000.123', 0)).toMatchInlineSnapshot(
    '12301000000000000020000n',
  )
  expect(parseUnits('12301000000000000020000.5', 0)).toMatchInlineSnapshot(
    '12301000000000000020001n',
  )
  expect(parseUnits('99999999999999999999999.5', 0)).toMatchInlineSnapshot(
    '100000000000000000000000n',
  )
})

test('decimals < fraction length', () => {
  expect(parseUnits('69.23521', 0)).toMatchInlineSnapshot('69n')
  expect(parseUnits('69.56789', 0)).toMatchInlineSnapshot('70n')
  expect(parseUnits('69.23521', 1)).toMatchInlineSnapshot('692n')
  expect(parseUnits('69.23521', 2)).toMatchInlineSnapshot('6924n')
  expect(parseUnits('69.23221', 2)).toMatchInlineSnapshot('6923n')
  expect(parseUnits('69.23261', 3)).toMatchInlineSnapshot('69233n')
  expect(parseUnits('999999.99999', 3)).toMatchInlineSnapshot('1000000000n')
  expect(parseUnits('699999.99999', 3)).toMatchInlineSnapshot('700000000n')
  expect(parseUnits('699999.98999', 3)).toMatchInlineSnapshot('699999990n')
  expect(parseUnits('699959.99999', 3)).toMatchInlineSnapshot('699960000n')
  expect(parseUnits('699099.99999', 3)).toMatchInlineSnapshot('699100000n')
  expect(parseUnits('100000.000999', 3)).toMatchInlineSnapshot('100000001n')
  expect(parseUnits('100000.990999', 3)).toMatchInlineSnapshot('100000991n')
  expect(parseUnits('69.00221', 3)).toMatchInlineSnapshot('69002n')
  expect(parseUnits('1.0536059576998882', 7)).toMatchInlineSnapshot('10536060n')
  expect(parseUnits('1.0053059576998882', 7)).toMatchInlineSnapshot('10053060n')
  expect(parseUnits('1.0000000900000000', 7)).toMatchInlineSnapshot('10000001n')
  expect(parseUnits('1.0000009900000000', 7)).toMatchInlineSnapshot('10000010n')
  expect(parseUnits('1.0000099900000000', 7)).toMatchInlineSnapshot('10000100n')
  expect(parseUnits('1.0000092900000000', 7)).toMatchInlineSnapshot('10000093n')
  expect(parseUnits('1.5536059576998882', 7)).toMatchInlineSnapshot('15536060n')
  expect(parseUnits('1.0536059476998882', 7)).toMatchInlineSnapshot('10536059n')
  expect(parseUnits('1.4545454545454545', 7)).toMatchInlineSnapshot('14545455n')
  expect(parseUnits('1.1234567891234567', 7)).toMatchInlineSnapshot('11234568n')
  expect(parseUnits('1.8989898989898989', 7)).toMatchInlineSnapshot('18989899n')
  expect(parseUnits('9.9999999999999999', 7)).toMatchInlineSnapshot(
    '100000000n',
  )
  expect(parseUnits('0.0536059576998882', 7)).toMatchInlineSnapshot('536060n')
  expect(parseUnits('0.0053059576998882', 7)).toMatchInlineSnapshot('53060n')
  expect(parseUnits('0.0000000900000000', 7)).toMatchInlineSnapshot('1n')
  expect(parseUnits('0.0000009900000000', 7)).toMatchInlineSnapshot('10n')
  expect(parseUnits('0.0000099900000000', 7)).toMatchInlineSnapshot('100n')
  expect(parseUnits('0.0000092900000000', 7)).toMatchInlineSnapshot('93n')
  expect(parseUnits('0.0999999999999999', 7)).toMatchInlineSnapshot('1000000n')
  expect(parseUnits('0.0099999999999999', 7)).toMatchInlineSnapshot('100000n')
  expect(parseUnits('0.00000000059', 9)).toMatchInlineSnapshot('1n')
  expect(parseUnits('0.0000000003', 9)).toMatchInlineSnapshot('0n')
  expect(parseUnits('69.00000000000', 9)).toMatchInlineSnapshot('69000000000n')
  expect(parseUnits('69.00000000019', 9)).toMatchInlineSnapshot('69000000000n')
  expect(parseUnits('69.00000000059', 9)).toMatchInlineSnapshot('69000000001n')
  expect(parseUnits('69.59000000059', 9)).toMatchInlineSnapshot('69590000001n')
  expect(parseUnits('69.59000002359', 9)).toMatchInlineSnapshot('69590000024n')
})

test('rejects non-decimal input with InvalidDecimalNumberError', () => {
  // scientific / hex / alpha / multi-dot all fail /^(-?)([0-9]*)\.?([0-9]*)$/.
  expect(() => parseUnits('1e6', 6)).toThrow(InvalidDecimalNumberError)
  expect(() => parseUnits('0x10', 6)).toThrow(InvalidDecimalNumberError)
  expect(() => parseUnits('abc', 6)).toThrow(InvalidDecimalNumberError)
  expect(() => parseUnits('5.5.5', 6)).toThrow(InvalidDecimalNumberError)
})

test('permissive inputs do not throw (viem-inherited permissiveness)', () => {
  expect(parseUnits('', 6)).toBe(0n)
  expect(parseUnits('.', 6)).toBe(0n)
  expect(parseUnits('-', 6)).toBe(0n)
  expect(parseUnits('.5', 6)).toBe(500000n)
  expect(parseUnits('5.', 6)).toBe(5000000n)
})

test('large-value precision (pure bigint, no float loss)', () => {
  const trx64 = 18446744073709551616n // 2^64
  expect(trx64).toBe(2n ** 64n)
  expect(parseUnits(trx64.toString(), 6)).toBe(trx64 * 10n ** 6n)
  expect(parseUnits(trx64.toString(), 6)).toBe(18446744073709551616000000n)
  expect(formatUnits(trx64 * 10n ** 6n, 6)).toBe(trx64.toString())

  const trx256 =
    115792089237316195423570985008687907853269984665640564039457584007913129639936n // 2^256
  expect(trx256).toBe(2n ** 256n)
  expect(parseUnits(trx256.toString(), 6)).toBe(trx256 * 10n ** 6n)
  expect(formatUnits(trx256 * 10n ** 6n, 6)).toBe(trx256.toString())
})

test('round-trip: formatUnits(parseUnits(x, 6), 6) === normalized x', () => {
  const vectors: [string, string][] = [
    ['1', '1'],
    ['0.5', '0.5'],
    ['0.000001', '0.000001'],
    ['6942069420.123456', '6942069420.123456'],
    ['1.230000', '1.23'], // trailing fraction zeros trimmed
    ['0.100000', '0.1'],
    ['-1', '-1'],
    ['-0.5', '-0.5'],
    ['-6942069420.123456', '-6942069420.123456'],
  ]
  for (const [input, normalized] of vectors)
    expect(formatUnits(parseUnits(input, 6), 6)).toBe(normalized)
})
