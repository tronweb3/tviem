import { expect, test } from 'vitest'

import { InvalidAddressError } from '../../../src/errors/address.js'
import type { AddressInput } from '../../../src/types/address.js'
import { hexToBytes, stringToBytes } from '../../../src/utils/encoding/toBytes.js'
import { flex, normalizeAddress } from '../../../src/utils/transaction/normalize.js'

// §2.1 V1.
const v1 = '417e5f4552091a69125d5dfcb7b8c2659029395bdf' as const

test('normalizeAddress: every accepted form pivots to the same 21 bytes', () => {
  const bytes = hexToBytes(`0x${v1}`)
  expect(normalizeAddress('TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC')).toStrictEqual(
    bytes,
  )
  expect(normalizeAddress(v1)).toStrictEqual(bytes)
  expect(
    normalizeAddress('0x7e5f4552091a69125d5dfcb7b8c2659029395bdf'),
  ).toStrictEqual(bytes)
  expect(normalizeAddress(bytes)).toStrictEqual(bytes)
})

test('normalizeAddress: invalid input throws InvalidAddressError', () => {
  expect(() => normalizeAddress('T123')).toThrow(InvalidAddressError)
  expect(() => normalizeAddress('' as AddressInput)).toThrow(
    InvalidAddressError,
  )
  expect(() => normalizeAddress(new Uint8Array(19))).toThrow(
    InvalidAddressError,
  )
})

test('flex: auto mode — 0x hex decodes as hex, other strings as UTF-8', () => {
  expect(flex('1000001')).toStrictEqual(stringToBytes('1000001'))
  expect(flex('0x31303030303031')).toStrictEqual(hexToBytes('0x31303030303031'))
  // Both forms of the same TRC10 asset id normalize to identical bytes.
  expect(flex('1000001')).toStrictEqual(flex('0x31303030303031'))
})

test('flex: visible=true forces UTF-8', () => {
  expect(flex('1000001', true)).toStrictEqual(hexToBytes('0x31303030303031'))
  // Even a `0x`-looking string is treated as plain text.
  expect(flex('0x41', true)).toStrictEqual(stringToBytes('0x41'))
})

test('flex: visible=false forces hex (0x prefix optional)', () => {
  expect(flex('31303030303031', false)).toStrictEqual(
    hexToBytes('0x31303030303031'),
  )
  expect(flex('0x31303030303031', false)).toStrictEqual(
    hexToBytes('0x31303030303031'),
  )
  expect(() => flex('zz', false)).toThrow()
})

test('flex: Uint8Array passes through as a fresh copy', () => {
  const input = new Uint8Array([1, 2, 3])
  const output = flex(input, false)
  expect(output).toStrictEqual(input)
  expect(output).not.toBe(input)
})
