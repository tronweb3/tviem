// TRON-specific, clean-room tests for @tronweb3/tviem.
import { describe, expect, test } from 'vitest'

import { InvalidAddressError } from '../../../src/errors/address.js'
import { normalizeAddress } from '../../../src/utils/address/normalize.js'
import { hexToBytes } from '../../../src/utils/encoding/toBytes.js'
import { bytesToHex } from '../../../src/utils/encoding/toHex.js'

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

describe('normalizeAddress', () => {
  test.each(
    vectors,
  )('normalizes every accepted form of $base58 to the same 21-byte pivot', ({
    base58,
    hex41,
    evm0x,
  }) => {
    const pivot = `0x${hex41}` as const
    // Base58Check form.
    expect(bytesToHex(normalizeAddress(base58))).toBe(pivot)
    // TRON hex form, without and with `0x`.
    expect(bytesToHex(normalizeAddress(hex41))).toBe(pivot)
    expect(bytesToHex(normalizeAddress(pivot))).toBe(pivot)
    // Uppercase TRON hex form (e.g. sliced out of raw_data_hex).
    expect(
      bytesToHex(normalizeAddress(hex41.toUpperCase() as `41${string}`)),
    ).toBe(pivot)
    // EVM hex form (20 bytes, `0x`-prefixed).
    expect(bytesToHex(normalizeAddress(evm0x))).toBe(pivot)
    // Uint8Array forms: 21-byte pivot and bare 20-byte account id.
    expect(bytesToHex(normalizeAddress(hexToBytes(pivot)))).toBe(pivot)
    expect(bytesToHex(normalizeAddress(hexToBytes(evm0x)))).toBe(pivot)
  })

  test('returns a fresh Uint8Array (no aliasing of byte input)', () => {
    const input = hexToBytes(`0x${vectors[0].hex41}`)
    const output = normalizeAddress(input)
    expect(output).not.toBe(input)
    output[1] = 0xff
    expect(bytesToHex(input)).toBe(`0x${vectors[0].hex41}`)
  })

  test('throws InvalidAddressError on invalid input', () => {
    // Tampered Base58Check checksum.
    expect(() =>
      normalizeAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6X'),
    ).toThrow(InvalidAddressError)
    // Bad shapes.
    expect(() => normalizeAddress('T123')).toThrow(InvalidAddressError)
    expect(() => normalizeAddress('' as `T${string}`)).toThrow(
      InvalidAddressError,
    )
    // Bare EVM hex (40 chars) requires the `0x` prefix.
    expect(() =>
      normalizeAddress(
        '2b5ad5c4795c026514f8317c7a215e218dccd6cf' as `41${string}`,
      ),
    ).toThrow(InvalidAddressError)
    // 42-char hex must start with the `41` prefix byte.
    expect(() =>
      normalizeAddress('0x002b5ad5c4795c026514f8317c7a215e218dccd6cf'),
    ).toThrow(InvalidAddressError)
    // Non-hex garbage.
    expect(() => normalizeAddress('0xzz5ee0c52b5e3d02250a8d953ddea70d2678')) //
      .toThrow(InvalidAddressError)
    // Wrong byte lengths / prefix byte.
    expect(() => normalizeAddress(new Uint8Array(22))).toThrow(
      InvalidAddressError,
    )
    expect(() => normalizeAddress(new Uint8Array(21))).toThrow(
      InvalidAddressError,
    )
    // Non-string, non-bytes input.
    expect(() => normalizeAddress(123 as unknown as `T${string}`)).toThrow(
      InvalidAddressError,
    )
  })

  // GAP 1 (CRITICAL — security regression guard). Disambiguation pivots on
  // LENGTH (40-hex+`0x` → EVM, 42-hex+`41` → TRON), NOT on the `41` prefix.
  // A 40-hex EVM address whose FIRST BYTE is 0x41 must be kept as a full
  // 20-byte EVM body (0x41 version byte prepended to ALL 20 bytes) — never
  // misread as a TRON 41-prefixed address (that would silently drop a byte
  // and corrupt funds; the sibling `codeex` impl had exactly this bug).
  // This pins codeex-bug immunity / length-not-prefix disambiguation.
  test('keeps all 20 bytes of a 40-hex EVM address whose first byte is 0x41', () => {
    const evmBody = '0x41abcdef0123456789abcdef0123456789abcdef' // 40 hex chars
    const result = normalizeAddress(evmBody)
    // 0x41 version byte prepended to the FULL 20-byte body: [0x41, 0x41, 0xab, …].
    expect(result).toHaveLength(21)
    expect(result[0]).toBe(0x41) // version byte
    expect(result[1]).toBe(0x41) // first body byte — preserved, not consumed as a prefix
    // The trailing 20 bytes equal the input body exactly (no byte dropped).
    expect(bytesToHex(result.subarray(1))).toBe(evmBody)
    // Bare 40-hex (no `0x`) is rejected as ambiguous — both a 41-leading one
    // and a non-41 one throw, since only the `0x` prefix marks the EVM form.
    expect(() =>
      normalizeAddress('41abcdef0123456789abcdef0123456789abcdef'),
    ).toThrow(InvalidAddressError)
    expect(() =>
      normalizeAddress(
        '2b5ad5c4795c026514f8317c7a215e218dccd6cf' as `41${string}`,
      ),
    ).toThrow(InvalidAddressError)
  })

  // GAP 3. The parser regex is [0-9a-fA-F] — mixed-case hex is accepted and
  // normalized case-insensitively to the same lowercase-output pivot.
  test('normalizes mixed-case TRON hex identically to its lowercase form', () => {
    const mixed = '0x417E5f4552091a69125D5dfCB7b8c2659029395BdF' // mixed upper/lower
    const lower = '0x417e5f4552091a69125d5dfcb7b8c2659029395bdf'
    expect(bytesToHex(normalizeAddress(mixed))).toBe(lower)
    expect(bytesToHex(normalizeAddress(mixed))).toBe(
      bytesToHex(normalizeAddress(lower)),
    )
  })

  // GAP 4. Over-length hex STRING forms (only Uint8Array(22) over-length was
  // tested before). 44- and 43-char hex bodies match neither the 42-char TRON
  // nor the 40-char EVM length → rejected.
  test('throws InvalidAddressError on over-length (43/44-char) hex strings', () => {
    // 44 hex chars (42-char TRON hex + 2 extra).
    expect(() =>
      normalizeAddress('0x417e5f4552091a69125d5dfcb7b8c2659029395bdfab'),
    ).toThrow(InvalidAddressError)
    // 43 hex chars (42-char TRON hex + 1 extra).
    expect(() =>
      normalizeAddress('0x417e5f4552091a69125d5dfcb7b8c2659029395bdfa'),
    ).toThrow(InvalidAddressError)
  })
})
