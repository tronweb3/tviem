// TRON-specific, clean-room tests for @tronweb3/tviem.
import { describe, expect, test } from 'vitest'

import { InvalidAddressError } from '../../../src/errors/address.js'
import {
  decodeBase58Check,
  encodeBase58Check,
  tryDecodeBase58Check,
} from '../../../src/utils/address/base58check.js'
import { hexToBytes } from '../../../src/utils/encoding/toBytes.js'
import { bytesToHex } from '../../../src/utils/encoding/toHex.js'

// §2.1 global test vectors (byte-compared against TronWeb).
const v1 = {
  base58: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC',
  hex41: '0x417e5f4552091a69125d5dfcb7b8c2659029395bdf',
} as const
const v2 = {
  base58: 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
  hex41: '0x412b5ad5c4795c026514f8317c7a215e218dccd6cf',
} as const
const v3 = {
  base58: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  hex41: '0x41a614f803b6fd780986a42c78ec9c7f77e6ded13c',
} as const

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

function pseudoRandomBytes(rand: () => number, length: number) {
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) bytes[i] = Math.floor(rand() * 256)
  return bytes
}

describe('encodeBase58Check', () => {
  test('encodes the 21-byte pivot of V1/V2/V3 (§2.1)', () => {
    expect(encodeBase58Check(hexToBytes(v1.hex41))).toBe(v1.base58)
    expect(encodeBase58Check(hexToBytes(v2.hex41))).toBe(v2.base58)
    expect(encodeBase58Check(hexToBytes(v3.hex41))).toBe(v3.base58)
  })

  test('canonical TRON address is 34 characters, T-prefixed', () => {
    const encoded = encodeBase58Check(hexToBytes(v1.hex41))
    expect(encoded).toHaveLength(34)
    expect(encoded.startsWith('T')).toBe(true)
  })
})

describe('decodeBase58Check', () => {
  test('inverts encodeBase58Check for V1/V2/V3', () => {
    expect(bytesToHex(decodeBase58Check(v1.base58))).toBe(v1.hex41)
    expect(bytesToHex(decodeBase58Check(v2.base58))).toBe(v2.hex41)
    expect(bytesToHex(decodeBase58Check(v3.base58))).toBe(v3.hex41)
  })

  test('throws InvalidAddressError on tampered checksum', () => {
    // V3 with the last character changed (t → X).
    expect(() =>
      decodeBase58Check('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6X'),
    ).toThrow(InvalidAddressError)
    expect(() =>
      decodeBase58Check('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6X'),
    ).toThrow('Address "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6X" is invalid.')
  })

  test('throws on non-Base58 / too-short / empty input', () => {
    // `0`, `O`, `I`, `l` are not in the Base58 alphabet.
    expect(() => decodeBase58Check('T0OIl')).toThrow(InvalidAddressError)
    // Decodes to fewer than 5 bytes.
    expect(() => decodeBase58Check('T123')).toThrow(InvalidAddressError)
    expect(() => decodeBase58Check('')).toThrow(InvalidAddressError)
  })
})

describe('tryDecodeBase58Check', () => {
  test('returns the payload on valid input', () => {
    expect(bytesToHex(tryDecodeBase58Check(v2.base58)!)).toBe(v2.hex41)
  })

  test('returns null (never throws) on malformed input', () => {
    expect(tryDecodeBase58Check('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6X')).toBe(
      null,
    )
    expect(tryDecodeBase58Check('T0OIl')).toBe(null)
    expect(tryDecodeBase58Check('T123')).toBe(null)
    expect(tryDecodeBase58Check('')).toBe(null)
    expect(tryDecodeBase58Check(null as unknown as string)).toBe(null)
    expect(tryDecodeBase58Check(undefined as unknown as string)).toBe(null)
  })
})

describe('properties', () => {
  test('encode/decode round-trips 200 random 20-byte payloads', () => {
    const rand = mulberry32(0xdecafbad)
    for (let i = 0; i < 200; i++) {
      const payload = pseudoRandomBytes(rand, 20)
      const encoded = encodeBase58Check(payload)
      expect(bytesToHex(decodeBase58Check(encoded))).toBe(bytesToHex(payload))
    }
  })
})
