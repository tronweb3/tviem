import { secp256k1 } from '@noble/curves/secp256k1'
import { describe, expect, test } from 'vitest'
import { generatePrivateKey } from '../../src/accounts/generatePrivateKey.js'
import { hexToBytes } from '../../src/utils/encoding/toBytes.js'

describe('generatePrivateKey', () => {
  test('returns a 0x-prefixed 64-hex-char key', () => {
    const key = generatePrivateKey()
    expect(key).toMatch(/^0x[0-9a-f]{64}$/)
    expect(key).toHaveLength(66)
  })

  test('returns a valid secp256k1 scalar (1 ≤ k < n)', () => {
    const key = generatePrivateKey()
    const bytes = hexToBytes(key)
    expect(bytes).toHaveLength(32)
    expect(secp256k1.utils.isValidPrivateKey(bytes)).toBe(true)
  })

  test('produces distinct keys across calls', () => {
    const keys = new Set(Array.from({ length: 32 }, () => generatePrivateKey()))
    expect(keys.size).toBe(32)
  })
})
