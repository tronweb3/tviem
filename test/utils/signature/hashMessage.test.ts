// TRON-specific, clean-room tests for @tronweb3/omni.
import { describe, expect, test } from 'vitest'

import { stringToBytes } from '../../../src/utils/encoding/toBytes.js'
import { keccak256 } from '../../../src/utils/hash/keccak256.js'
import { hashMessage, presignMessagePrefix } from '../../../src/utils/signature/hashMessage.js'

// Canonical TIP-191 digest for the current package name (pk = 1). Verified
// byte-for-byte against TronWeb's `utils.message.hashMessage`. (The pre-rename
// spec constant 0xdd7bd740… is stale: it is the digest of the former message,
// not of the string below.)
const message = 'hello @tronweb3/omni'
const digest =
  '0x068a2c93df26c5f19fb1d6b74abe50efc69cbff8b70a9cc9b915058e0ed9a18e'

describe('hashMessage', () => {
  test('matches the TronWeb-verified TIP-191 digest', () => {
    expect(hashMessage(message)).toBe(digest)
  })

  test('uses the TIP-191 prefix (0x19 "TRON Signed Message:\\n")', () => {
    expect(presignMessagePrefix).toBe('\x19TRON Signed Message:\n')
  })

  test('empty string uses a length of 0', () => {
    expect(hashMessage('')).toBe(
      keccak256(stringToBytes(`${presignMessagePrefix}0`)),
    )
  })

  test('measures length in UTF-8 bytes, not code points', () => {
    // "é" is 1 code point but 2 UTF-8 bytes; "🚀" is 1 code point but 4 bytes.
    const multibyte = 'é🚀'
    const messageBytes = stringToBytes(multibyte)
    expect(messageBytes.length).toBe(6)
    const expected = keccak256(
      new Uint8Array([
        ...stringToBytes(`${presignMessagePrefix}${messageBytes.length}`),
        ...messageBytes,
      ]),
    )
    expect(hashMessage(multibyte)).toBe(expected)
  })

  test('accepts { raw } bytes and hashes them as-is', () => {
    const raw = new Uint8Array([1, 2, 3])
    const expected = keccak256(
      new Uint8Array([...stringToBytes(`${presignMessagePrefix}3`), ...raw]),
    )
    expect(hashMessage({ raw })).toBe(expected)
    expect(hashMessage({ raw: '0x010203' })).toBe(expected)
  })

  test('can return bytes', () => {
    const bytes = hashMessage(message, 'bytes')
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBe(32)
  })
})
