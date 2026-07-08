import { expect, test } from 'vitest'

import { deriveRefBlockParams, fillBlockHeader } from './prepareTransaction.js'
import type { RawData } from './serializeRawData.js'

// A block id whose hex chars 16..32 are the §2.3 ref_block_hash.
const blockID = `${'00'.repeat(8)}0102030405060708${'00'.repeat(16)}`

test('deriveRefBlockParams: reverses the §2.3 TaPoS fields', () => {
  const { refBlockBytes, refBlockHash } = deriveRefBlockParams(0x1234, blockID)
  expect(refBlockBytes).toBe('1234')
  expect(refBlockHash).toBe('0102030405060708')
})

test('deriveRefBlockParams: ref_block_bytes is the low 2 bytes, left-padded', () => {
  expect(deriveRefBlockParams(5, blockID).refBlockBytes).toBe('0005')
  expect(deriveRefBlockParams(0xabcdef, blockID).refBlockBytes).toBe('cdef')
  expect(deriveRefBlockParams(0x10000n, blockID).refBlockBytes).toBe('0000')
})

test('deriveRefBlockParams: accepts a 0x-prefixed block id', () => {
  expect(deriveRefBlockParams(0x1234, `0x${blockID}`).refBlockHash).toBe(
    '0102030405060708',
  )
})

test('fillBlockHeader: sets TaPoS and expiration = now + 60000', () => {
  const rawData: RawData = { contract: [], timestamp: 1700000000000n }
  const filled = fillBlockHeader(
    rawData,
    { number: 0x1234, blockID },
    1700000000000n,
  )
  expect(filled.refBlockBytes).toBe('1234')
  expect(filled.refBlockHash).toBe('0102030405060708')
  expect(filled.expiration).toBe(1700000060000n)
  // Original is not mutated; unrelated fields are preserved.
  expect(rawData.refBlockBytes).toBeUndefined()
  expect(filled.timestamp).toBe(1700000000000n)
})

test('fillBlockHeader: never reads the wall clock (now is supplied)', () => {
  const filled = fillBlockHeader({ contract: [] }, { number: 1, blockID }, 0)
  expect(filled.expiration).toBe(60000n)
})
