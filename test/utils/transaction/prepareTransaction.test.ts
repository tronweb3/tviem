import { expect, test } from 'vitest'

import { BaseError } from '../../../src/errors/base.js'
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

test('deriveRefBlockParams: bare and 0x-prefixed block ids agree', () => {
  expect(deriveRefBlockParams(1, `0x${blockID}`)).toEqual(
    deriveRefBlockParams(1, blockID),
  )
})

test('deriveRefBlockParams: a bigint past 2^64 still takes the low 2 bytes', () => {
  expect(
    deriveRefBlockParams(2n ** 64n + 0xabcdn, blockID).ref_block_bytes,
  ).toBe('abcd')
})

// A malformed id used to be laundered into shape-valid TaPoS fields — e.g. the
// 16-byte id yielded a full-width all-zero ref_block_hash — that the node only
// rejects at broadcast, after signatures were collected.
test.each([
  ['16-byte', '0'.repeat(32)],
  ['odd-nibble (63 chars)', 'a'.repeat(63)],
  ['long (65 chars)', 'a'.repeat(65)],
  ['non-hex', 'z'.repeat(64)],
  ['empty', ''],
])('deriveRefBlockParams: rejects an invalid blockID (%s)', (_, id) => {
  expect(() => deriveRefBlockParams(1n, id)).toThrow(BaseError)
  expect(() => deriveRefBlockParams(1n, id)).toThrow(/Invalid blockID/)
})

test.each([
  ['negative bigint', -1n],
  ['negative number', -1],
  ['fractional', 1.5],
  ['NaN', Number.NaN],
  ['Infinity', Number.POSITIVE_INFINITY],
  ['-Infinity', Number.NEGATIVE_INFINITY],
  ['unsafe (2^53)', 2 ** 53],
])('deriveRefBlockParams: rejects an invalid blockNumber (%s)', (_, blockNumber) => {
  expect(() => deriveRefBlockParams(blockNumber, blockID)).toThrow(BaseError)
  expect(() => deriveRefBlockParams(blockNumber, blockID)).toThrow(
    /Invalid blockNumber/,
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
    { number: 1, blockID, timestamp: 1 },
  )
  expect(filled.timestamp).toBe(1n)
  expect(filled.expiration).toBe(60001n)
})

test('fillBlockHeader: expirationMs overrides the one-minute lifetime', () => {
  const filled = fillBlockHeader(
    { contract: [] },
    { number: 1, blockID, timestamp: 1700000000000n },
    { expirationMs: 3_600_000 },
  )
  expect(filled.expiration).toBe(1700000000000n + 3_600_000n)
})

test('fillBlockHeader: the 24h java-tron maximum is accepted inclusively', () => {
  const filled = fillBlockHeader(
    { contract: [] },
    { number: 1, blockID, timestamp: 1700000000000n },
    { expirationMs: 86_400_000n },
  )
  expect(filled.expiration).toBe(1700000000000n + 86_400_000n)
})

// java-tron rejects an expiration further than 24h past the reference block,
// and a non-positive or fractional lifetime is meaningless — all fail before
// anything is built or signed, as a typed error (BigInt(1.5) would otherwise
// escape as a raw RangeError).
test.each([
  ['zero', 0],
  ['negative', -60_000],
  ['beyond 24h', 86_400_001],
  ['fractional', 1.5],
])('fillBlockHeader: rejects an invalid expirationMs (%s)', (_, expirationMs) => {
  expect(() =>
    fillBlockHeader(
      { contract: [] },
      { number: 1, blockID, timestamp: 1700000000000n },
      { expirationMs },
    ),
  ).toThrow(/expirationMs/)
})

// A degenerate block (what formatBlock yields for a malformed node body:
// number/timestamp decoded as 0, blockID as '') must not silently become a
// signable transaction with ref_block_bytes "0000" and a 1970 expiration —
// the node would only reject it at broadcast, after the caller signed it.
test.each([
  ['zero number', { number: 0, blockID, timestamp: 1700000000000n }],
  ['zero timestamp', { number: 1, blockID, timestamp: 0 }],
  ['empty blockID', { number: 1, blockID: '', timestamp: 1700000000000n }],
  [
    'short blockID',
    { number: 1, blockID: 'ab'.repeat(16), timestamp: 1700000000000n },
  ],
])('fillBlockHeader: rejects an incomplete block (%s)', (_, block) => {
  expect(() => fillBlockHeader({ contract: [] }, block)).toThrow(
    /incomplete block/,
  )
})
