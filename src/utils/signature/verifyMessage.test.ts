// TRON-specific, clean-room tests for @tronweb3/omni.
import { describe, expect, test } from 'vitest'
import { hashMessage } from './hashMessage.js'
import { signMessage } from './signMessage.js'
import {
  recoverMessageAddress,
  recoverPublicKey,
  verifyMessage,
} from './verifyMessage.js'

// Canonical TIP-191 vector for the current package name (pk = 1). Verified
// byte-for-byte against TronWeb's `utils.message`.
const pk1 =
  '0x0000000000000000000000000000000000000000000000000000000000000001' as const
const message = 'hello @tronweb3/omni'
const address = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'
const publicKey =
  '0x0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8'
const messageSignature =
  '855e95dd49d937f13c6cbc5293db9b6fdfab8780d7c27c6eff9b12f8f3d3d56d792f34efe0adb183778c8e6f4c8f1cf66e19bd06be967bc7874613f4ee135dea1b'

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
        message: 'goodbye @tronweb3/omni',
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
