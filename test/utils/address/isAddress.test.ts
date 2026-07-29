// TRON-specific, clean-room tests for @tronweb3/tviem.
import { describe, expect, test } from 'vitest'

import { isAddress } from '../../../src/utils/address/isAddress.js'

describe('isAddress (strict, default)', () => {
  test('accepts canonical Base58Check addresses (§2.1 V1/V2/V3)', () => {
    expect(isAddress('TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC')).toBe(true)
    expect(isAddress('TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K')).toBe(true)
    expect(isAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')).toBe(true)
  })

  test('rejects the §2.1 negative examples', () => {
    // Tampered checksum (last character changed).
    expect(isAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6X')).toBe(false)
    // EVM 0x form is non-canonical (aligned with TronWeb).
    expect(isAddress('0x2b5ad5c4795c026514f8317c7a215e218dccd6cf')).toBe(false)
    expect(isAddress('T123')).toBe(false)
    expect(isAddress('')).toBe(false)
  })

  test('rejects TRON hex forms (only Base58Check is canonical)', () => {
    expect(isAddress('412b5ad5c4795c026514f8317c7a215e218dccd6cf')).toBe(false)
    expect(isAddress('0x412b5ad5c4795c026514f8317c7a215e218dccd6cf')).toBe(
      false,
    )
  })

  test('never throws on garbage input', () => {
    expect(isAddress('hello world')).toBe(false)
    expect(isAddress('0xzz')).toBe(false)
    // Right shape, invalid Base58 alphabet characters (0, O, I, l).
    expect(isAddress('T0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl0')).toBe(false)
    // 34 chars, valid alphabet, broken checksum.
    expect(isAddress('TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9L')).toBe(false)
    expect(isAddress(null as unknown as string)).toBe(false)
    expect(isAddress(undefined as unknown as string)).toBe(false)
    expect(isAddress(123 as unknown as string)).toBe(false)
    expect(isAddress({} as unknown as string)).toBe(false)
  })
})

describe('isAddress({ strict: false })', () => {
  test('additionally accepts TRON hex and EVM hex forms', () => {
    expect(
      isAddress('412b5ad5c4795c026514f8317c7a215e218dccd6cf', {
        strict: false,
      }),
    ).toBe(true)
    expect(
      isAddress('0x412b5ad5c4795c026514f8317c7a215e218dccd6cf', {
        strict: false,
      }),
    ).toBe(true)
    expect(
      isAddress('0x2b5ad5c4795c026514f8317c7a215e218dccd6cf', {
        strict: false,
      }),
    ).toBe(true)
    expect(
      isAddress('TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K', { strict: false }),
    ).toBe(true)
  })

  test('still rejects invalid input, without throwing', () => {
    expect(
      isAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6X', { strict: false }),
    ).toBe(false)
    expect(isAddress('T123', { strict: false })).toBe(false)
    expect(isAddress('', { strict: false })).toBe(false)
    // Bare EVM hex (no 0x) is not an accepted form.
    expect(
      isAddress('2b5ad5c4795c026514f8317c7a215e218dccd6cf', { strict: false }),
    ).toBe(false)
    expect(isAddress(null as unknown as string, { strict: false })).toBe(false)
  })
})
