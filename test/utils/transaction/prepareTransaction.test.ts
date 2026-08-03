import { expect, test } from 'vitest'

import {
  deriveRefBlockParams,
  fillBlockHeader,
} from '../../../src/utils/transaction/prepareTransaction.js'
import type { RawData } from '../../../src/utils/transaction/serializeRawData.js'

// A block id whose hex chars 16..32 are the §2.3 ref_block_hash.
const blockID = `${'00'.repeat(8)}0102030405060708${'00'.repeat(16)}`

test('deriveRefBlockParams: reverses the §2.3 TaPoS fields', () => {
  const { ref_block_bytes: refBlockBytes, ref_block_hash: refBlockHash } =
    deriveRefBlockParams(0x1234, blockID)
  expect(refBlockBytes).toBe('1234')
  expect(refBlockHash).toBe('0102030405060708')
})

test('deriveRefBlockParams: ref_block_bytes is the low 2 bytes, left-padded', () => {
  expect(deriveRefBlockParams(5, blockID).ref_block_bytes).toBe('0005')
  expect(deriveRefBlockParams(0xabcdef, blockID).ref_block_bytes).toBe('cdef')
  expect(deriveRefBlockParams(0x10000n, blockID).ref_block_bytes).toBe('0000')
})

test('deriveRefBlockParams: accepts a 0x-prefixed block id', () => {
  expect(deriveRefBlockParams(0x1234, `0x${blockID}`).ref_block_hash).toBe(
    '0102030405060708',
  )
})

test('fillBlockHeader: sets TaPoS, timestamp and expiration from the block', () => {
  const rawData: RawData = { contract: [] }
  const filled = fillBlockHeader(rawData, {
    number: 0x1234,
    blockID,
    timestamp: 1700000000000n,
  })
  expect(filled.ref_block_bytes).toBe('1234')
  expect(filled.ref_block_hash).toBe('0102030405060708')
  // Both timing fields come from the block's own timestamp (chain time).
  expect(filled.timestamp).toBe(1700000000000n)
  expect(filled.expiration).toBe(1700000060000n)
  // Original is not mutated; unrelated fields are preserved.
  expect(rawData.ref_block_bytes).toBeUndefined()
})

test('fillBlockHeader: never reads the wall clock (timing is chain-derived)', () => {
  const filled = fillBlockHeader(
    { contract: [] },
    { number: 1, blockID, timestamp: 0 },
  )
  expect(filled.timestamp).toBe(0n)
  expect(filled.expiration).toBe(60000n)
})
