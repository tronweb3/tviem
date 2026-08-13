import { expect, test } from 'vitest'
import { getLogs } from '../../../src/actions/public/getLogs.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
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
      blockTimestamp: 1_780_912_191_000n,
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

test('non-strict keeps an undecodable log raw; strict drops it', async () => {
  // `data` is empty, so `value` cannot be decoded → DecodeLogDataMismatch.
  const truncated = { ...rawLog, data: '0x' }

  const lenient = mock([truncated])
  const kept = await getLogs(lenient.client, { event: transferEvent })
  expect(kept).toHaveLength(1)
  expect(kept[0]?.eventName).toBe('Transfer')
  expect(kept[0]?.args).toBeUndefined()

  const strict = mock([truncated])
  const dropped = await getLogs(strict.client, {
    event: transferEvent,
    strict: true,
  })
  expect(dropped).toEqual([])
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
  await expect(getLogs(client, {})).rejects.toThrow(
    'exceed max block range: 5000',
  )
})

test('an absent result formats to an empty log list', async () => {
  const { client } = mock(undefined)
  expect(await getLogs(client)).toEqual([])
})
