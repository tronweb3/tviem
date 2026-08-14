import { expect, test } from 'vitest'
import { getLogs } from '../../../src/actions/public/getLogs.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { TronRpcError } from '../../../src/errors/rpc.js'
import { toEventSelector } from '../../../src/utils/hash/toEventSelector.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

const usdt = 'TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe'
const usdtEvm = '0x0123456789abcdef0123456789abcdef01234567'
const emitter = 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs'
const emitterEvm = '0x42a1e39aefa49290f2b3f9ed688d7cecf86cd6e0'
const from = 'TCHqEXgJzVv4X5mv4PNsFzD666wswQ2YkQ'
const to = 'TTopo6cMBAReiVe11nYcbPj6HqsJrtpmFg'

const transferEvent = {
  type: 'event',
  name: 'Transfer',
  inputs: [
    { indexed: true, name: 'from', type: 'address' },
    { indexed: true, name: 'to', type: 'address' },
    { indexed: false, name: 'value', type: 'uint256' },
  ],
} as const

const approvalEvent = {
  type: 'event',
  name: 'Approval',
  inputs: [
    { indexed: true, name: 'owner', type: 'address' },
    { indexed: true, name: 'spender', type: 'address' },
    { indexed: false, name: 'value', type: 'uint256' },
  ],
} as const

/** The ERC-721 `Transfer` layout — same selector as ERC-20, all indexed. */
const nftTransferEvent = {
  type: 'event',
  name: 'Transfer',
  inputs: [
    { indexed: true, name: 'from', type: 'address' },
    { indexed: true, name: 'to', type: 'address' },
    { indexed: true, name: 'tokenId', type: 'uint256' },
  ],
} as const

const transferTopic =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const approvalTopic =
  '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'

const blockHash =
  '0x0000000003e8a947c68442f90bb271d2f7b1b8bb86f6a78a1d4f2d53ab92d81d' as const

/** The doc example log: `Transfer(from, to, 7561729)` emitted by `emitter`. */
const rawLog = {
  address: emitterEvm,
  blockHash,
  blockNumber: '0x3e8a947',
  blockTimestamp: '0x6a26903f',
  data: '0x0000000000000000000000000000000000000000000000000000000000736201',
  logIndex: '0x0',
  removed: false,
  topics: [
    transferTopic,
    '0x0000000000000000000000001975fbea3496424a88de2a147d76baa34a3d1b93',
    '0x000000000000000000000000c3abfbceb364febe625662a9af6add366df58f81',
  ],
  transactionHash:
    '0xba60eb123d557f6b9ffefae573499b9d65ee15430a55b24cb28ef4ab2118f814',
  transactionIndex: '0x1',
}

function mock(result: unknown) {
  const { transport, calls } = createMockTransport({
    responses: {
      '/jsonrpc': { response: { jsonrpc: '2.0', id: 1, result } },
    },
  })
  return { client: createPublicClient({ transport }), calls }
}

test('sends an eth_getLogs request and formats the returned logs', async () => {
  const { client, calls } = mock([rawLog])

  const logs = await getLogs(client, {
    address: usdt,
    fromBlock: 65_579_000n,
    toBlock: 'latest',
  })

  const call = calls[0]
  expect(call?.node).toBe('full')
  expect(call?.method).toBe('POST')
  expect(call?.path).toBe('/jsonrpc')
  expect(call?.body).toEqual({
    jsonrpc: '2.0',
    id: expect.any(Number),
    method: 'eth_getLogs',
    params: [
      {
        address: usdtEvm,
        fromBlock: '0x3e8a7f8',
        toBlock: 'latest',
      },
    ],
  })

  expect(logs).toEqual([
    {
      address: emitter,
      blockHash: rawLog.blockHash,
      blockNumber: 65_579_335n,
      // Seconds, exactly as the bridge sent it (viem's log shape) — the one
      // deliberate exception to the library's milliseconds convention.
      blockTimestamp: 1_780_912_191n,
      data: rawLog.data,
      logIndex: 0,
      removed: false,
      topics: rawLog.topics,
      transactionHash: rawLog.transactionHash,
      transactionIndex: 1,
    },
  ])
})

test('accepts an address list and numeric blocks', async () => {
  const { client, calls } = mock([])
  await getLogs(client, { address: [usdt, emitter], fromBlock: 100 })
  const [filter] = (calls[0]?.body as { params: unknown[] }).params
  expect(filter).toEqual({
    address: [usdtEvm, emitterEvm],
    fromBlock: '0x64',
  })
})

test('event + args: encodes the topic filter and decodes the logs', async () => {
  const { client, calls } = mock([rawLog])

  const logs = await getLogs(client, {
    address: emitter,
    event: transferEvent,
    args: { from },
    fromBlock: 1n,
    toBlock: 2n,
  })

  const [filter] = (calls[0]?.body as { params: unknown[] }).params
  expect(filter).toEqual({
    address: emitterEvm,
    topics: [
      transferTopic,
      '0x0000000000000000000000001975fbea3496424a88de2a147d76baa34a3d1b93',
      // The unfiltered `to` topic stays a wildcard.
      null,
    ],
    fromBlock: '0x1',
    toBlock: '0x2',
  })

  expect(logs).toHaveLength(1)
  expect(logs[0]?.eventName).toBe('Transfer')
  expect(logs[0]?.args).toEqual({ from, to, value: 7_561_729n })
})

// An array arg entry is an OR-list of alternatives; an explicit null keeps
// that indexed position a wildcard (same contract as viem's args filter).
test('args: OR-list alternatives and explicit null wildcards', async () => {
  const { client, calls } = mock([rawLog])
  await getLogs(client, {
    event: transferEvent,
    args: { from: [from, to], to: null },
  })
  const [filter] = (calls[0]?.body as { params: unknown[] }).params
  expect(filter).toEqual({
    topics: [
      transferTopic,
      [
        '0x0000000000000000000000001975fbea3496424a88de2a147d76baa34a3d1b93',
        '0x000000000000000000000000c3abfbceb364febe625662a9af6add366df58f81',
      ],
      null,
    ],
  })
})

test('args: positional form with a null hole', async () => {
  const { client, calls } = mock([])
  await getLogs(client, {
    event: transferEvent,
    args: [null, to],
  })
  const [filter] = (calls[0]?.body as { params: unknown[] }).params
  expect(filter).toEqual({
    topics: [
      transferTopic,
      null,
      '0x000000000000000000000000c3abfbceb364febe625662a9af6add366df58f81',
    ],
  })
})

test('events: filters on a topic0 OR-list and decodes per log', async () => {
  const { client, calls } = mock([rawLog])

  const logs = await getLogs(client, {
    events: [transferEvent, approvalEvent],
  })

  const [filter] = (calls[0]?.body as { params: unknown[] }).params
  expect(filter).toEqual({ topics: [[transferTopic, approvalTopic]] })
  expect(logs[0]?.eventName).toBe('Transfer')
  expect(logs[0]?.args).toEqual({ from, to, value: 7_561_729n })
})

test('passes a raw topics filter through unchanged', async () => {
  const { client, calls } = mock([])
  const topics = [null, [transferTopic, approvalTopic]] as const
  await getLogs(client, { topics })
  const [filter] = (calls[0]?.body as { params: unknown[] }).params
  expect(filter).toEqual({ topics })
})

test('non-strict partially decodes a mismatched log; strict drops it', async () => {
  // `data` is empty, so `value` cannot be decoded — but the indexed
  // parameters are still recoverable from the topics.
  const truncated = { ...rawLog, data: '0x' }

  const lenient = mock([truncated])
  const kept = await getLogs(lenient.client, { event: transferEvent })
  expect(kept).toHaveLength(1)
  expect(kept[0]?.eventName).toBe('Transfer')
  expect(kept[0]?.args).toEqual({ from, to })

  const strict = mock([truncated])
  const dropped = await getLogs(strict.client, {
    event: transferEvent,
    strict: true,
  })
  expect(dropped).toEqual([])
})

test('a log whose selector matches none of the events is dropped', async () => {
  // An Approval log against a Transfer-only filter (nodes can return more
  // than the topic filter asked for): dropped in both modes.
  const approvalLog = {
    ...rawLog,
    topics: [approvalTopic, ...rawLog.topics.slice(1)],
  }

  const lenient = mock([approvalLog])
  expect(await getLogs(lenient.client, { event: transferEvent })).toEqual([])

  const strict = mock([approvalLog])
  expect(
    await getLogs(strict.client, { event: transferEvent, strict: true }),
  ).toEqual([])
})

test('same-selector overloads: each candidate is tried until one decodes', async () => {
  // An ERC-721 Transfer: the third parameter is a topic and `data` is empty.
  const nftLog = {
    ...rawLog,
    data: '0x',
    topics: [...rawLog.topics, `0x${'2a'.padStart(64, '0')}`],
  }

  const { client } = mock([rawLog, nftLog])
  const logs = await getLogs(client, {
    events: [transferEvent, nftTransferEvent],
    strict: true,
  })

  expect(logs).toHaveLength(2)
  expect(logs[0]?.args).toEqual({ from, to, value: 7_561_729n })
  expect(logs[1]?.args).toEqual({ from, to, tokenId: 42n })
})

test('non-strict recovers a missing indexed parameter from data', async () => {
  // An ERC-20-shaped log read through the ERC-721 layout: `tokenId` has no
  // topic, so its value is decoded out of `data` instead.
  const { client } = mock([rawLog])
  const logs = await getLogs(client, { event: nftTransferEvent })
  expect(logs[0]?.eventName).toBe('Transfer')
  expect(logs[0]?.args).toEqual({ from, to, tokenId: 7_561_729n })
})

test('non-strict falls back to eventName-only when the topics fail to decode', async () => {
  // An undersized argument topic fails to decode even leniently: the log
  // keeps its event name and an empty args container.
  const badTopic = { ...rawLog, topics: [transferTopic, '0xdead'] }
  const named = mock([badTopic])
  const namedLogs = await getLogs(named.client, { event: transferEvent })
  expect(namedLogs).toHaveLength(1)
  expect(namedLogs[0]?.eventName).toBe('Transfer')
  expect(namedLogs[0]?.args).toEqual({})

  // Unnamed inputs get the positional container.
  const pingEvent = {
    type: 'event',
    name: 'Ping',
    inputs: [{ indexed: true, type: 'bool' }],
  } as const
  const pingLog = {
    ...rawLog,
    topics: [toEventSelector('Ping(bool)'), '0xdead'],
    data: '0x',
  }
  const unnamed = mock([pingLog])
  const unnamedLogs = await getLogs(unnamed.client, { event: pingEvent })
  expect(unnamedLogs).toHaveLength(1)
  expect(unnamedLogs[0]?.eventName).toBe('Ping')
  expect(unnamedLogs[0]?.args).toEqual([])
})

test('non-strict falls back to the FIRST given event of a shared selector', async () => {
  // Only `from` has a topic; `data` carries two words. Under the first given
  // layout they decode as the recovered `to` then `value` — the ERC-721
  // alternative would have labeled the second word `tokenId` instead.
  const short = {
    ...rawLog,
    topics: [transferTopic, rawLog.topics[1]!],
    data: `${rawLog.topics[2]}${rawLog.data.slice(2)}`,
  }
  const { client } = mock([short])
  const logs = await getLogs(client, {
    events: [transferEvent, nftTransferEvent],
  })
  expect(logs[0]?.args).toEqual({ from, to, value: 7_561_729n })
})

test('the plural events path shares the drop and partial-decode semantics', async () => {
  const truncated = { ...rawLog, data: '0x' }
  const unknown = { ...rawLog, topics: [`0x${'ab'.repeat(32)}`] }

  const lenient = mock([truncated, unknown])
  const kept = await getLogs(lenient.client, {
    events: [transferEvent, approvalEvent],
  })
  expect(kept).toHaveLength(1)
  expect(kept[0]?.eventName).toBe('Transfer')
  expect(kept[0]?.args).toEqual({ from, to })

  const strict = mock([truncated, unknown])
  expect(
    await getLogs(strict.client, {
      events: [transferEvent, approvalEvent],
      strict: true,
    }),
  ).toEqual([])
})

test('blockHash restricts to one block and rejects a block range', async () => {
  const { client, calls } = mock([])
  await getLogs(client, { blockHash })
  const [filter] = (calls[0]?.body as { params: unknown[] }).params
  expect(filter).toEqual({ blockHash })

  await expect(
    getLogs(client, {
      blockHash,
      fromBlock: 1n,
    } as never),
  ).rejects.toThrow('`blockHash` cannot be used together')
  // Both range bounds are guarded, not just fromBlock.
  await expect(
    getLogs(client, {
      blockHash,
      toBlock: 'latest',
    } as never),
  ).rejects.toThrow('`blockHash` cannot be used together')
})

test('throws a TronRpcError on a JSON-RPC error response', async () => {
  const { transport } = createMockTransport({
    responses: {
      '/jsonrpc': {
        response: {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32602, message: 'exceed max block range: 5000' },
        },
      },
    },
  })
  const client = createPublicClient({ transport })
  const err = (await getLogs(client, {}).catch((e) => e)) as TronRpcError
  expect(err).toBeInstanceOf(TronRpcError)
  expect(err.message).toContain('exceed max block range: 5000')
  expect(err.metaMessages).toContain('Code: -32602')
})

// The bridge always populates blockTimestamp for mined logs; when a proxy
// drops it the key is omitted rather than fabricated as 0n.
test('a log without blockTimestamp omits the field', async () => {
  const { blockTimestamp: _dropped, ...withoutTimestamp } = rawLog
  const { client } = mock([withoutTimestamp])
  const [log] = await getLogs(client, {})
  expect(log && 'blockTimestamp' in log).toBe(false)
})

test('an absent result formats to an empty log list', async () => {
  const { client } = mock(undefined)
  expect(await getLogs(client)).toEqual([])
})
