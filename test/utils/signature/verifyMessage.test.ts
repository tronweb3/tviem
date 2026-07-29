// TRON-specific, clean-room tests for @tronweb3/tviem.
import { describe, expect, test } from 'vitest'
import { hashMessage } from '../../../src/utils/signature/hashMessage.js'
import { signMessage } from '../../../src/utils/signature/signMessage.js'
import {
  recoverMessageAddress,
  recoverPublicKey,
  verifyMessage,
} from '../../../src/utils/signature/verifyMessage.js'

// Canonical TIP-191 vector for the current package name (pk = 1). Verified
// byte-for-byte against TronWeb's `utils.message`.
const pk1 =
  '0x0000000000000000000000000000000000000000000000000000000000000001' as const
const message = 'sign this message'
const address = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'
const publicKey =
  '0x0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8'
const messageSignature =
  '9db3012a68317a97618479e218f3ca6849714071c2a8f07c160f1a804b114a8e166364cb124269a0edea614f50ae2acd0fd3a2c97ae89f45b4811427fb6136b71b'

describe('recoverPublicKey', () => {
  test('recovers the V1 uncompressed public key', () => {
    expect(
      recoverPublicKey({
        hash: hashMessage(message),
        signature: `0x${messageSignature}`,
      }),
    ).toBe(publicKey)
  })
})

describe('recoverMessageAddress', () => {
  test('recovers TMVQGm… from the canonical signature', () => {
    expect(
      recoverMessageAddress({ message, signature: `0x${messageSignature}` }),
    ).toBe(address)
  })

  test('accepts a bare (no 0x) wire-form signature', () => {
    expect(
      recoverMessageAddress({ message, signature: messageSignature }),
    ).toBe(address)
  })

  test('accepts a Signature object', () => {
    const signature = signMessage({ message, privateKey: pk1 })
    expect(recoverMessageAddress({ message, signature })).toBe(address)
  })

  test('round-trips freshly signed messages', () => {
    const msg = 'a different message'
    const signature = signMessage({ message: msg, privateKey: pk1 })
    expect(recoverMessageAddress({ message: msg, signature })).toBe(address)
  })
})

describe('verifyMessage', () => {
  test('verifies the canonical signature', () => {
    expect(
      verifyMessage({ message, signature: `0x${messageSignature}`, address }),
    ).toBe(true)
  })

  test('accepts other address forms', () => {
    expect(
      verifyMessage({
        message,
        signature: `0x${messageSignature}`,
        address: '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf',
      }),
    ).toBe(true)
  })

  test('rejects a tampered address', () => {
    expect(
      verifyMessage({
        message,
        signature: `0x${messageSignature}`,
        address: 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
      }),
    ).toBe(false)
  })

  test('rejects a tampered message', () => {
    expect(
      verifyMessage({
        message: 'goodbye world',
        signature: `0x${messageSignature}`,
        address,
      }),
    ).toBe(false)
  })

  test('rejects a tampered signature', () => {
    // Flip the first byte of `r` (85 -> 3f); recovery still yields a point,
    // but a different address.
    const tampered = `3f${messageSignature.slice(2)}`
    expect(verifyMessage({ message, signature: tampered, address })).toBe(false)
  })

  test('returns false (never throws) on a malformed signature', () => {
    expect(verifyMessage({ message, signature: '0xdeadbeef', address })).toBe(
      false,
    )
  })
})
