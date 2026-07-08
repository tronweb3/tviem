// TRON-specific, clean-room tests for @tronweb3/omni.
import { describe, expect, test } from 'vitest'

import { InvalidAddressError } from '../../errors/address.js'
import { hexToBytes } from '../encoding/toBytes.js'
import { addressToHex, toEvm } from './toEvm.js'

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
    base58: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    hex41: '41a614f803b6fd780986a42c78ec9c7f77e6ded13c',
    evm0x: '0xa614f803b6fd780986a42c78ec9c7f77e6ded13c',
  },
] as const

describe('toEvm', () => {
  test.each(vectors)('converts every accepted form to $evm0x', ({
    base58,
    hex41,
    evm0x,
  }) => {
    expect(toEvm(base58)).toBe(evm0x)
    expect(toEvm(hex41)).toBe(evm0x)
    expect(toEvm(`0x${hex41}`)).toBe(evm0x)
    expect(toEvm(evm0x)).toBe(evm0x)
    expect(toEvm(hexToBytes(`0x${hex41}`))).toBe(evm0x)
    expect(toEvm(hexToBytes(evm0x))).toBe(evm0x)
  })

  test('outputs 0x + 40 lowercase hex characters', () => {
    const evm = toEvm(vectors[0].base58)
    expect(evm).toHaveLength(42)
    expect(evm.startsWith('0x')).toBe(true)
    expect(evm).toBe(evm.toLowerCase())
  })

  test('throws InvalidAddressError on invalid input', () => {
    expect(() => toEvm('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6X')).toThrow(
      InvalidAddressError,
    )
    expect(() => toEvm('T123')).toThrow(InvalidAddressError)
    expect(() => toEvm('' as `T${string}`)).toThrow(InvalidAddressError)
  })
})

describe('addressToHex (ABI adapter)', () => {
  test.each(vectors)('returns the 20-byte 0x form of $base58', (vector) => {
    expect(addressToHex(vector.base58)).toBe(vector.evm0x)
    expect(addressToHex(vector.hex41)).toBe(vector.evm0x)
    expect(addressToHex(vector.evm0x)).toBe(vector.evm0x)
  })

  test('throws InvalidAddressError on invalid input', () => {
    expect(() => addressToHex('T123')).toThrow(InvalidAddressError)
  })
})
