import { describe, expect, test } from 'vitest'

import { stringToBytes } from '../../../src/utils/encoding/toBytes.js'
import { keccak256 } from '../../../src/utils/hash/keccak256.js'
import {
  hashMessage,
  presignMessagePrefix,
} from '../../../src/utils/signature/hashMessage.js'

// Canonical TIP-191 digest for the current package name (pk = 1). Verified
// byte-for-byte against TronWeb's `utils.message.hashMessage`. (The pre-rename
// spec constant 0xdd7bd740… is stale: it is the digest of the former message,
// not of the string below.)
const message = 'sign this message'
const digest =
  '0x46971b5b1d980410d80acba57293e39e27ed19dd6ff1015a8ebd9f8e0cc4edd9'

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

  // A raw hex string is bytes: `hexToBytes` would left-pad an odd nibble
  // count ("0x123" hashing identically to "0x0123") and silently drop the
  // leading byte of an unprefixed string (`slice(2)`), so both are refused —
  // a digest over bytes the caller never wrote must not be signable.
  test('rejects a raw hex string with an odd nibble count', () => {
    expect(() => hashMessage({ raw: '0x123' })).toThrow()
  })

  test('rejects a raw hex string without the 0x prefix', () => {
    expect(() => hashMessage({ raw: '010203' as `0x${string}` })).toThrow()
  })
})
