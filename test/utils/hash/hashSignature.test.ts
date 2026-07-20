import { expect, test } from 'vitest'

import { stringToBytes, toBytes } from '../../../src/utils/encoding/toBytes.js'
import { hashSignature } from '../../../src/utils/hash/hashSignature.js'
import { keccak256 } from '../../../src/utils/hash/keccak256.js'

test('hashes signatures', () => {
  expect(hashSignature('transfer(address,uint256)')).toEqual(
    '0xa9059cbb2ab09eb219583f4a59a5d0623ade346d962bcd4e46b11da047c9049b',
  )
  // first 4 bytes are the well-known ERC-20 `transfer` selector.
  expect(hashSignature('transfer(address,uint256)').slice(0, 10)).toEqual(
    '0xa9059cbb',
  )
  expect(hashSignature('Transfer(address,address,uint256)')).toEqual(
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  )
})

test('equivalent to keccak256(toBytes(signature))', () => {
  for (const signature of [
    'transfer(address,uint256)',
    'Transfer(address,address,uint256)',
    'ownerOf(uint256)',
  ])
    expect(hashSignature(signature)).toEqual(keccak256(toBytes(signature)))
})

test('encodes the signature as UTF-8 text', () => {
  const signature = 'transfer(address,uint256)'
  expect(hashSignature(signature)).toEqual(keccak256(stringToBytes(signature)))
})

test('hex-looking input is decoded as raw bytes, not UTF-8 text', () => {
  // pins viem-aligned behavior: `toBytes` hex-decodes strict-hex strings, so a
  // hex-looking "signature" hashes its 4 raw bytes rather than its 10-char text.
  expect(hashSignature('0xdeadbeef')).toEqual(keccak256('0xdeadbeef'))
  expect(hashSignature('0xdeadbeef')).not.toEqual(
    keccak256(stringToBytes('0xdeadbeef')),
  )
})
