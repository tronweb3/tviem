import { describe, expect, test } from 'vitest'

import { hashMessage } from '../../../src/utils/signature/hashMessage.js'
import { sign } from '../../../src/utils/signature/sign.js'
import { signMessage } from '../../../src/utils/signature/signMessage.js'

// Canonical TIP-191 signature for the current package name (pk = 1). Verified
// byte-for-byte against TronWeb's `utils.message.signMessage`.
const pk1 =
  '0x0000000000000000000000000000000000000000000000000000000000000001' as const
const message = 'sign this message'
const messageSignature =
  '9db3012a68317a97618479e218f3ca6849714071c2a8f07c160f1a804b114a8e166364cb124269a0edea614f50ae2acd0fd3a2c97ae89f45b4811427fb6136b71b'

describe('signMessage', () => {
  test('signs to the TronWeb-verified signature (…6b71b, v = 27)', () => {
    const signature = signMessage({ message, privateKey: pk1 })
    expect(signature.hex).toBe(messageSignature)
    expect(signature.serialized).toBe(`0x${messageSignature}`)
    expect(signature.serialized.endsWith('6b71b')).toBe(true)
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
