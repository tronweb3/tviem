import { describe, expect, test } from 'vitest'

import { InvalidAddressError } from '../../../src/errors/address.js'
import { addressToHex, toEvm } from '../../../src/utils/address/toEvm.js'
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
    expect(() => toEvm('TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLX')).toThrow(
      InvalidAddressError,
    )
    expect(() => toEvm('T123')).toThrow(InvalidAddressError)
    expect(() => toEvm('' as `T${string}`)).toThrow(InvalidAddressError)
  })

  // GAP 1 (CRITICAL — security regression guard). Disambiguation pivots on
  // LENGTH, NOT on the `41` prefix. A 40-hex EVM address whose FIRST BYTE is
  // 0x41 must round-trip losslessly (all 20 bytes preserved) — never be
  // misread as a TRON 41-prefixed address that drops a byte. The sibling
  // `codeex` impl had exactly this silent fund-corruption bug; this pins
  // codeex-bug immunity / length-not-prefix disambiguation.
  test('round-trips a 40-hex EVM address whose first byte is 0x41 losslessly', () => {
    const evmBody = '0x41abcdef0123456789abcdef0123456789abcdef' // 40 hex chars
    expect(toEvm(evmBody)).toBe(evmBody)
    // Contrast: a REAL TRON 42-hex `0x41…` DOES strip its `41` version byte.
    expect(toEvm('0x417e5f4552091a69125d5dfcb7b8c2659029395bdf')).toBe(
      '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf',
    )
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
