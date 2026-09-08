import { describe, expect, test } from 'vitest'
import {
  int64InputToBigInt,
  int64ToJson,
} from '../../../src/utils/transaction/int64.js'

describe('int64InputToBigInt', () => {
  test.each([
    ['bigint', 9n, 9n],
    ['negative bigint', -42n, -42n],
    ['number', 7, 7n],
    ['zero', 0, 0n],
    ['decimal string', '100', 100n],
    ['negative decimal string', '-5', -5n],
    ['string past 2^53', '9007199254740993', 9007199254740993n],
  ])('accepts a %s', (_, input, expected) => {
    expect(int64InputToBigInt('amount', input as never)).toBe(expected)
  })

  test('rejects an unsafe-integer number', () => {
    expect(() => int64InputToBigInt('amount', 2 ** 53)).toThrow(
      'not a safe integer',
    )
  })

  test('rejects a non-decimal string', () => {
    expect(() => int64InputToBigInt('amount', '0x64')).toThrow(
      'not a decimal integer string',
    )
  })

  test('rejects a BigNumber-style object — toString and valueOf are two reads', () => {
    // The regex validates `String(value)` while `BigInt(value)` consults
    // `valueOf`: two DIFFERENT conversions of a mutable object, so the value
    // that passes validation need not be the value that encodes — into the
    // signed bytes. Primitives only, by decision.
    const divergent = {
      toString: () => '1',
      valueOf: () => 1_000_000_000n,
    }
    expect(() => int64InputToBigInt('amount', divergent as never)).toThrow(
      'expected a bigint, number or decimal string, got object',
    )
  })

  test.each([
    ['a boxed Number', new Number(42)],
    ['a boxed String', new String('42')],
    ['null', null],
    ['a boolean', true],
    ['undefined', undefined],
  ])('rejects %s', (_, input) => {
    expect(() => int64InputToBigInt('amount', input as never)).toThrow(
      'expected a bigint, number or decimal string',
    )
  })
})

describe('int64ToJson', () => {
  test('renders within-2^53 values as numbers, beyond as decimal strings', () => {
    expect(int64ToJson(1n)).toBe(1)
    expect(int64ToJson(-9007199254740991n)).toBe(-9007199254740991)
    expect(int64ToJson(9007199254740992n)).toBe('9007199254740992')
  })
})
