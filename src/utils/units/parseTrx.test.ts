import { expect, test } from 'vitest'

import { parseTrx } from './parseTrx.js'

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
