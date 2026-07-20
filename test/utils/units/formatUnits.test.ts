import { expect, test } from 'vitest'

import { formatUnits } from '../../../src/utils/units/formatUnits.js'
import { parseUnits } from '../../../src/utils/units/parseUnits.js'

test('converts value to number', () => {
  expect(formatUnits(69n, 0)).toMatchInlineSnapshot('"69"')
  expect(formatUnits(69n, 5)).toMatchInlineSnapshot('"0.00069"')
  expect(formatUnits(690n, 1)).toMatchInlineSnapshot('"69"')
  expect(formatUnits(1300000n, 5)).toMatchInlineSnapshot('"13"')
  expect(formatUnits(4200000000000n, 10)).toMatchInlineSnapshot('"420"')
  expect(formatUnits(20000000000n, 9)).toMatchInlineSnapshot('"20"')
  expect(formatUnits(40000000000000000000n, 18)).toMatchInlineSnapshot('"40"')
  expect(formatUnits(10000000000000n, 18)).toMatchInlineSnapshot('"0.00001"')
  expect(formatUnits(12345n, 4)).toMatchInlineSnapshot('"1.2345"')
  expect(formatUnits(12345n, 4)).toMatchInlineSnapshot('"1.2345"')
  expect(formatUnits(6942069420123456789123450000n, 18)).toMatchInlineSnapshot(
    '"6942069420.12345678912345"',
  )
  expect(
    formatUnits(
      694212312312306942012345444446789123450000000000000000000000000000000n,
      50,
    ),
  ).toMatchInlineSnapshot('"6942123123123069420.1234544444678912345"')
  expect(formatUnits(-690n, 1)).toMatchInlineSnapshot('"-69"')
  expect(formatUnits(-1300000n, 5)).toMatchInlineSnapshot('"-13"')
  expect(formatUnits(-4200000000000n, 10)).toMatchInlineSnapshot('"-420"')
  expect(formatUnits(-20000000000n, 9)).toMatchInlineSnapshot('"-20"')
  expect(formatUnits(-40000000000000000000n, 18)).toMatchInlineSnapshot('"-40"')
  expect(formatUnits(-12345n, 4)).toMatchInlineSnapshot('"-1.2345"')
  expect(formatUnits(-12345n, 4)).toMatchInlineSnapshot('"-1.2345"')
  expect(formatUnits(-6942069420123456789123450000n, 18)).toMatchInlineSnapshot(
    '"-6942069420.12345678912345"',
  )
  expect(
    formatUnits(
      -694212312312306942012345444446789123450000000000000000000000000000000n,
      50,
    ),
  ).toMatchInlineSnapshot('"-6942123123123069420.1234544444678912345"')
})

test('large-value precision (pure bigint, no float loss)', () => {
  const trx64 = 18446744073709551616n // 2^64
  expect(formatUnits(trx64 * 10n ** 6n, 6)).toBe(trx64.toString())

  const trx256 =
    115792089237316195423570985008687907853269984665640564039457584007913129639936n // 2^256
  expect(formatUnits(trx256 * 10n ** 6n, 6)).toBe(trx256.toString())

  // raw sun value carrying a full 6-digit fraction, sliced (not float-divided).
  expect(formatUnits(trx256, 6)).toBe(
    '115792089237316195423570985008687907853269984665640564039457584007913129.639936',
  )
})

test('round-trip: parseUnits(formatUnits(v, 6), 6) === v (integer sun)', () => {
  const vectors = [
    0n,
    1n,
    10n,
    500000n,
    1000000n,
    6942069420123456n,
    -1n,
    -500000n,
    -6942069420123456n,
    18446744073709551616n, // 2^64
    115792089237316195423570985008687907853269984665640564039457584007913129639936n, // 2^256
  ]
  for (const v of vectors) expect(parseUnits(formatUnits(v, 6), 6)).toBe(v)
})
