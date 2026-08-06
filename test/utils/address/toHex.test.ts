import { describe, expect, test } from 'vitest'

import { InvalidAddressError } from '../../../src/errors/address.js'
import { toHex } from '../../../src/utils/address/toHex.js'
import { hexToBytes } from '../../../src/utils/encoding/toBytes.js'

// §2.1 global test vectors (byte-compared against TronWeb).
const vectors = [
  {
    base58: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC',
    hex41: '417e5f4552091a69125d5dfcb7b8c2659029395bdf',
    evm0x: '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf',
  },
  {
    base58: 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
    hex41: '412b5ad5c4795c026514f8317c7a215e218dccd6cf',
    evm0x: '0x2b5ad5c4795c026514f8317c7a215e218dccd6cf',
  },
  {
    base58: 'TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe',
    hex41: '410123456789abcdef0123456789abcdef01234567',
    evm0x: '0x0123456789abcdef0123456789abcdef01234567',
  },
] as const

describe('toHex', () => {
  test.each(vectors)('converts every accepted form to $hex41', ({
    base58,
    hex41,
    evm0x,
  }) => {
    expect(toHex(base58)).toBe(hex41)
    expect(toHex(hex41)).toBe(hex41)
    expect(toHex(`0x${hex41}`)).toBe(hex41)
    expect(toHex(evm0x)).toBe(hex41)
    expect(toHex(hexToBytes(`0x${hex41}`))).toBe(hex41)
    expect(toHex(hexToBytes(evm0x))).toBe(hex41)
  })

  test('outputs 42 lowercase hex characters, 41-prefixed, without 0x', () => {
    const hex = toHex(vectors[0].base58)
    expect(hex).toHaveLength(42)
    expect(hex.startsWith('41')).toBe(true)
    expect(hex).toBe(hex.toLowerCase())
    expect(hex.startsWith('0x')).toBe(false)
  })

  test('lowercases uppercase hex input (e.g. sliced out of raw_data_hex)', () => {
    expect(
      toHex('417E5F4552091A69125D5DFCB7B8C2659029395BDF' as `41${string}`),
    ).toBe('417e5f4552091a69125d5dfcb7b8c2659029395bdf')
  })

  test('throws InvalidAddressError on invalid input', () => {
    expect(() => toHex('TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLX')).toThrow(
      InvalidAddressError,
    )
    expect(() => toHex('T123')).toThrow(InvalidAddressError)
    expect(() => toHex('' as `T${string}`)).toThrow(InvalidAddressError)
  })
})
