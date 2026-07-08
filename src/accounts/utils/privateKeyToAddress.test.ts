// TRON-specific, clean-room tests for @tronweb3/omni.
import { describe, expect, test } from 'vitest'

import { privateKeyToAddress } from './privateKeyToAddress.js'

// §2.1 global test vectors (byte-compared against TronWeb).
const v1 = {
  privateKey:
    '0x0000000000000000000000000000000000000000000000000000000000000001',
  base58: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC',
} as const
const v2 = {
  privateKey:
    '0x0000000000000000000000000000000000000000000000000000000000000002',
  base58: 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
} as const

describe('privateKeyToAddress', () => {
  test('§2.1: V1/V2 private keys map to their Base58Check addresses', () => {
    expect(privateKeyToAddress(v1.privateKey)).toBe(v1.base58)
    expect(privateKeyToAddress(v2.privateKey)).toBe(v2.base58)
  })

  test('accepts bare hex (no 0x prefix)', () => {
    expect(privateKeyToAddress(v1.privateKey.slice(2))).toBe(v1.base58)
    expect(privateKeyToAddress(v2.privateKey.slice(2))).toBe(v2.base58)
  })

  test('left-pads short keys to 32 bytes (TronWeb pkToAddress parity)', () => {
    expect(privateKeyToAddress('0x01')).toBe(v1.base58)
    expect(privateKeyToAddress('0x1')).toBe(v1.base58)
    expect(privateKeyToAddress('1')).toBe(v1.base58)
  })

  test('throws on invalid private keys', () => {
    // Longer than 32 bytes.
    expect(() => privateKeyToAddress(`0x00${v2.privateKey.slice(2)}`)) //
      .toThrow()
    // Not a valid secp256k1 scalar (zero).
    expect(() => privateKeyToAddress('0x00')).toThrow()
    // Not hex.
    expect(() => privateKeyToAddress('0xzz')).toThrow()
  })
})
