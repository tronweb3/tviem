// TRON-specific, clean-room tests for @tronweb3/omni.
import { describe, expect, test } from 'vitest'

import { hashMessage } from './hashMessage.js'
import { sign } from './sign.js'
import { signMessage } from './signMessage.js'

// Canonical TIP-191 signature for the current package name (pk = 1). Verified
// byte-for-byte against TronWeb's `utils.message.signMessage`.
const pk1 =
  '0x0000000000000000000000000000000000000000000000000000000000000001' as const
const message = 'hello @tronweb3/omni'
const messageSignature =
  '855e95dd49d937f13c6cbc5293db9b6fdfab8780d7c27c6eff9b12f8f3d3d56d792f34efe0adb183778c8e6f4c8f1cf66e19bd06be967bc7874613f4ee135dea1b'

describe('signMessage', () => {
  test('signs to the TronWeb-verified signature (…dea1b, v = 27)', () => {
    const signature = signMessage({ message, privateKey: pk1 })
    expect(signature.hex).toBe(messageSignature)
    expect(signature.serialized).toBe(`0x${messageSignature}`)
    expect(signature.serialized.endsWith('dea1b')).toBe(true)
    expect(signature.v).toBe(27)
  })

  test('equals sign({ hash: hashMessage(message) })', () => {
    expect(signMessage({ message, privateKey: pk1 }).serialized).toBe(
      sign({ hash: hashMessage(message), privateKey: pk1 }).serialized,
    )
  })

  test('accepts a bare (no 0x) private key', () => {
    expect(signMessage({ message, privateKey: pk1.slice(2) }).hex).toBe(
      messageSignature,
    )
  })

  test('is deterministic (RFC 6979) by default', () => {
    expect(signMessage({ message, privateKey: pk1 }).hex).toBe(
      signMessage({ message, privateKey: pk1 }).hex,
    )
  })

  test('extraEntropy randomizes the signature', () => {
    const randomized = signMessage({
      message,
      privateKey: pk1,
      extraEntropy: true,
    })
    expect(randomized.hex).not.toBe(messageSignature)
    expect([27, 28]).toContain(randomized.v)
  })

  test('signs { raw } messages', () => {
    const signature = signMessage({
      message: { raw: '0x010203' },
      privateKey: pk1,
    })
    expect(signature.hex).toHaveLength(130)
  })
})
