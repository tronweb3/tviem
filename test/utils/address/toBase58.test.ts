import { describe, expect, test } from 'vitest'

import { InvalidAddressError } from '../../../src/errors/address.js'
import { addressToHex } from '../../../src/utils/address/addressToHex.js'
import { hexToBase58, toBase58 } from '../../../src/utils/address/toBase58.js'
import { toEvm } from '../../../src/utils/address/toEvm.js'
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

// Deterministic PRNG (mulberry32) so property-test failures are reproducible.
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('toBase58', () => {
  test.each(vectors)('converts every accepted form to $base58', ({
    base58,
    hex41,
    evm0x,
  }) => {
    expect(toBase58(base58)).toBe(base58)
    expect(toBase58(hex41)).toBe(base58)
    expect(toBase58(`0x${hex41}`)).toBe(base58)
    expect(toBase58(evm0x)).toBe(base58)
    expect(toBase58(hexToBytes(`0x${hex41}`))).toBe(base58)
    expect(toBase58(hexToBytes(evm0x))).toBe(base58)
  })

  test.each(vectors)('round-trips toBase58(addressToHex(toEvm($base58)))', ({
    base58,
  }) => {
    expect(toBase58(addressToHex(toEvm(base58)))).toBe(base58)
  })

  test('round-trips 200 random 20-byte payloads across all three forms', () => {
    const rand = mulberry32(0xc0ffee)
    for (let i = 0; i < 200; i++) {
      const payload = new Uint8Array(20)
      for (let j = 0; j < 20; j++) payload[j] = Math.floor(rand() * 256)
      const base58 = toBase58(payload)
      expect(toBase58(addressToHex(toEvm(base58)))).toBe(base58)
      expect(toBase58(toEvm(addressToHex(base58)))).toBe(base58)
    }
  })

  test('throws InvalidAddressError on invalid input', () => {
    expect(() => toBase58('TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLX')).toThrow(
      InvalidAddressError,
    )
    expect(() => toBase58('T123')).toThrow(InvalidAddressError)
    expect(() => toBase58('0x123')).toThrow(InvalidAddressError)
    expect(() => toBase58('' as `T${string}`)).toThrow(InvalidAddressError)
  })
})

describe('hexToBase58 (ABI adapter)', () => {
  test('converts a 20-byte EVM hex address to Base58Check', () => {
    expect(hexToBase58('0x2b5ad5c4795c026514f8317c7a215e218dccd6cf')).toBe(
      'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
    )
    expect(hexToBase58('0x0123456789abcdef0123456789abcdef01234567')).toBe(
      'TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe',
    )
  })

  test('throws InvalidAddressError on invalid input', () => {
    expect(() => hexToBase58('0x123')).toThrow(InvalidAddressError)
  })
})
