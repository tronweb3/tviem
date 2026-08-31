import { expect, test } from 'vitest'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { BlockNotFoundError } from '../../../src/errors/rpc.js'
import {
  type BlockRef,
  deriveRefBlockParams,
} from '../../../src/utils/transaction/prepareTransaction.js'
import { rpc, rpcReq } from '../../fixtures/rpc/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

test('getNowBlock GETs the full node and maps the raw block', async () => {
  const { transport, calls } = createMockTransport({
    responses: { getnowblock: { response: rpc('getnowblock.fixed') } },
  })
  const client = createPublicClient({ transport })

  const block = await client.getNowBlock()
  expect(block.number).toBe(4660n)
  expect(block.timestamp).toBe(1700000000000n)
  expect(block.blockID).toBe(
    '00000000000012340102030405060708090a0b0c0d0e0f101112131415161718',
  )
  expect(block.parentHash).toBe(
    '00000000000012331112131415161718090a0b0c0d0e0f100102030405060708',
  )
  expect(block.version).toBe(28)
  // 41-hex witness -> Base58 boundary.
  expect(block.witnessAddress).toBe('TPL66VK2gCXNCD7EJg9pgJRfqcRazjhUZY')

  // sent-right: full node, GET, no body prefix.
  expect(calls[0]?.node).toBe('full')
  expect(calls[0]?.path).toBe('getnowblock')
  expect(calls[0]?.method).toBe('GET')
})

test('a formatted Block satisfies BlockRef (feeds TaPoS derivation)', async () => {
  const { transport } = createMockTransport({
    responses: { getnowblock: { response: rpc('getnowblock.fixed') } },
  })
  const client = createPublicClient({ transport })

  const block = await client.getNowBlock()
  const ref: BlockRef = block // compile-time: Block is assignable to BlockRef.
  const { ref_block_bytes: refBlockBytes, ref_block_hash: refBlockHash } =
    deriveRefBlockParams(ref.number, ref.blockID)
  expect(refBlockBytes).toBe('1234')
  expect(refBlockHash).toBe('0102030405060708')
})

test('getBlock POSTs the numeric block number and maps the block', async () => {
  const { transport, calls, bodyOf } = createMockTransport({
    responses: { getblockbynum: { response: rpc('getblockbynum') } },
  })
  const client = createPublicClient({ transport })

  const block = await client.getBlock({ blockNumber: 4660n })
  expect(block.number).toBe(4660n)
  expect(block.witnessAddress).toBe('TPL66VK2gCXNCD7EJg9pgJRfqcRazjhUZY')

  // sent-right: full node, numeric `num` body.
  expect(calls[0]?.node).toBe('full')
  expect(calls[0]?.path).toBe('getblockbynum')
  expect(calls[0]?.method).toBe('POST')
  expect(bodyOf('getblockbynum')).toEqual({ num: 4660 })
  expect(bodyOf('getblockbynum')).toEqual(rpcReq('getblockbynum').body)
})

test('getBlock accepts a plain number for blockNumber', async () => {
  const { transport, bodyOf } = createMockTransport({
    responses: { getblockbynum: { response: rpc('getblockbynum') } },
  })
  const client = createPublicClient({ transport })

  await client.getBlock({ blockNumber: 4660 })
  expect(bodyOf('getblockbynum')).toEqual({ num: 4660 })
})

test('getBlock rejects negative, fractional, NaN and infinite block numbers', async () => {
  const { transport, calls } = createMockTransport({
    responses: { getblockbynum: { response: rpc('getblockbynum') } },
  })
  const client = createPublicClient({ transport })

  for (const blockNumber of [
    -1n,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ]) {
    await expect(
      client.getBlock({ blockNumber }),
      `blockNumber: ${blockNumber}`,
    ).rejects.toThrow('Invalid blockNumber')
  }
  // Nothing ever reached the node.
  expect(calls).toEqual([])
})

test('getBlock rejects block numbers above MAX_SAFE_INTEGER without calling the node', async () => {
  const { transport, calls } = createMockTransport({
    responses: { getblockbynum: { response: rpc('getblockbynum') } },
  })
  const client = createPublicClient({ transport })

  for (const blockNumber of [
    // The smallest bigint `Number()` silently rounds (2^53 + 1 -> 2^53).
    9_007_199_254_740_993n,
    2n ** 53n,
    2n ** 64n,
    9_007_199_254_740_992,
  ]) {
    await expect(
      client.getBlock({ blockNumber }),
      `blockNumber: ${blockNumber}`,
    ).rejects.toThrow('Invalid blockNumber')
  }
  // Nothing ever reached the node.
  expect(calls).toEqual([])
})

test('getBlock throws BlockNotFoundError on an empty ({}) body', async () => {
  const { transport } = createMockTransport({
    responses: { getblockbynum: { response: {} } },
  })
  const client = createPublicClient({ transport })

  await expect(
    client.getBlock({ blockNumber: 999999n }),
  ).rejects.toBeInstanceOf(BlockNotFoundError)
})

test('confirmed: true reads the block from the SolidityNode', async () => {
  const { transport, calls } = createMockTransport({
    responses: { getblockbynum: { response: rpc('getblockbynum') } },
  })
  const client = createPublicClient({ transport })

  await client.getBlock({ blockNumber: 4660n, confirmed: true })
  expect(calls[0]?.node).toBe('solidity')
})
