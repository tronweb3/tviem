import { describe, expect, test } from 'vitest'
import { privateKeyToAccount } from '../../src/accounts/privateKeyToAccount.js'
import {
  getContract,
  getFunctionParameters,
} from '../../src/actions/getContract.js'
import { createPublicClient } from '../../src/clients/createPublicClient.js'
import { createWalletClient } from '../../src/clients/createWalletClient.js'
import { walletActions } from '../../src/clients/decorators/wallet.js'
import {
  AbiEventNotFoundError,
  AbiEventOverloadError,
} from '../../src/errors/abi.js'
import type { Address } from '../../src/types/address.js'
import { rpc } from '../fixtures/rpc/loader.js'
import { createMockTransport } from '../mock/createMockTransport.js'
import { parseBroadcast } from '../mock/parseBroadcast.js'

const trc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const

const contractAddress = 'TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe' as Address
const holder = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC' as Address
// pk = 1 (permitted trivial key).
const account = privateKeyToAccount(`0x${'0'.repeat(63)}1`)

describe('getContract', () => {
  test('carries `abi` and `address` through', () => {
    const { transport } = createMockTransport({ responses: {} })
    const client = createPublicClient({ transport })
    const contract = getContract({
      abi: trc20Abi,
      address: contractAddress,
      client,
    })
    expect(contract.address).toBe(contractAddress)
    expect(contract.abi).toBe(trc20Abi)
  })

  describe('read (Public Client)', () => {
    test('read.balanceOf hits triggerconstantcontract and decodes the result', async () => {
      const { transport, calls } = createMockTransport({
        responses: {
          triggerconstantcontract: {
            response: rpc('triggerconstantcontract.trc20-balanceof'),
          },
        },
      })
      const client = createPublicClient({ transport })
      const contract = getContract({
        abi: trc20Abi,
        address: contractAddress,
        client,
      })

      const balance = await contract.read.balanceOf([holder], {
        account: holder,
      })
      expect(balance).toBe(123456789000000000000000000n)
      expect(calls.map((c) => c.path)).toEqual(['triggerconstantcontract'])
    })

    test('read.<fn> forwards abi / address / functionName / args to readContract', async () => {
      let captured: unknown
      const { transport } = createMockTransport({ responses: {} })
      const client = createPublicClient({ transport }).extend(() => ({
        readContract: async (parameters: unknown) => {
          captured = parameters
          return 7n
        },
      }))
      const contract = getContract({
        abi: trc20Abi,
        address: contractAddress,
        client,
      })

      const result = await contract.read.balanceOf([holder], {
        account: holder,
      })
      expect(result).toBe(7n)
      expect(captured).toMatchObject({
        abi: trc20Abi,
        address: contractAddress,
        functionName: 'balanceOf',
        args: [holder],
        account: holder,
      })
    })

    test('read.<fn> with no args treats the first argument as options', async () => {
      let captured: { args: readonly unknown[]; account?: Address } | undefined
      const { transport } = createMockTransport({ responses: {} })
      const client = createPublicClient({ transport }).extend(() => ({
        readContract: async (parameters: typeof captured) => {
          captured = parameters
          return 0n
        },
      }))
      const contract = getContract({
        abi: trc20Abi,
        address: contractAddress,
        client,
      })

      await contract.read.totalSupply({ account: holder })
      expect(captured?.args).toEqual([])
      expect(captured?.account).toBe(holder)
    })

    test('does not mount write / estimateEnergy on a Public Client', () => {
      const { transport } = createMockTransport({ responses: {} })
      const client = createPublicClient({ transport })
      const contract = getContract({
        abi: trc20Abi,
        address: contractAddress,
        client,
      })
      expect('read' in contract).toBe(true)
      expect('write' in contract).toBe(false)
      expect('estimateEnergy' in contract).toBe(false)
    })
  })

  describe('write (Wallet Client)', () => {
    test('write.transfer builds locally, broadcasts, and returns the local txID', async () => {
      const { transport, calls, bodyOf } = createMockTransport({
        responses: {
          getnowblock: { response: rpc('getnowblock.fixed') },
          broadcasttransaction: { response: { result: true } },
        },
      })
      const client = createWalletClient({ transport, account })
      const contract = getContract({
        abi: trc20Abi,
        address: contractAddress,
        client,
      })

      const result = await contract.write.transfer([holder, 1000n], {})

      // Local txID is authoritative and deterministic (timing comes from the
      // pinned reference block's own timestamp).
      expect(result.txID).toMatch(/^[0-9a-f]{64}$/)
      // Both node round-trips happened: fetch block, then broadcast.
      expect(calls.map((c) => c.path)).toEqual([
        'getnowblock',
        'broadcasttransaction',
      ])
      // The broadcast body is the whole signed transaction.
      const body = parseBroadcast(bodyOf('broadcasttransaction')) as {
        signature: string[]
        txID: string
      }
      expect(body.signature.length).toBeGreaterThan(0)
      expect(body.txID).toBe(result.txID)
    })

    test('write.<fn> forwards feeLimit / callValue / functionName / args', async () => {
      let captured: unknown
      const { transport } = createMockTransport({ responses: {} })
      const client = createWalletClient({ transport, account }).extend(() => ({
        writeContract: async (parameters: unknown) => {
          captured = parameters
          return { txID: 'deadbeef' }
        },
      }))
      const contract = getContract({
        abi: trc20Abi,
        address: contractAddress,
        client,
      })

      const result = await contract.write.transfer([holder, 1000n], {
        feeLimit: 10_000_000n,
        callValue: 5n,
      })
      expect(result).toEqual({ txID: 'deadbeef' })
      expect(captured).toMatchObject({
        abi: trc20Abi,
        address: contractAddress,
        functionName: 'transfer',
        args: [holder, 1000n],
        feeLimit: 10_000_000n,
        callValue: 5n,
      })
    })

    test('estimateEnergy.<fn> forwards to the estimateEnergy action', async () => {
      let captured: unknown
      const { transport } = createMockTransport({ responses: {} })
      const client = createWalletClient({ transport, account }).extend(() => ({
        estimateEnergy: async (parameters: unknown) => {
          captured = parameters
          return 31_895n
        },
      }))
      const contract = getContract({
        abi: trc20Abi,
        address: contractAddress,
        client,
      })

      const energy = await contract.estimateEnergy.transfer([holder, 1000n], {
        callValue: 5n,
      })
      expect(energy).toBe(31_895n)
      expect(captured).toMatchObject({
        functionName: 'transfer',
        args: [holder, 1000n],
        callValue: 5n,
      })
    })

    test('does not mount read on a bare Wallet Client', () => {
      const { transport } = createMockTransport({ responses: {} })
      const client = createWalletClient({ transport, account })
      const contract = getContract({
        abi: trc20Abi,
        address: contractAddress,
        client,
      })
      expect('write' in contract).toBe(true)
      expect('estimateEnergy' in contract).toBe(true)
      expect('read' in contract).toBe(false)
    })
  })

  describe('capability probing', () => {
    test('a client with both action sets mounts read, write, and estimateEnergy', () => {
      const { transport } = createMockTransport({ responses: {} })
      const client = createPublicClient({ transport }).extend(walletActions)
      const contract = getContract({
        abi: trc20Abi,
        address: contractAddress,
        client,
      })
      expect('read' in contract).toBe(true)
      expect('write' in contract).toBe(true)
      expect('estimateEnergy' in contract).toBe(true)
    })

    test('read is omitted for a read-only abi with no view/pure functions', () => {
      const writeOnlyAbi = [
        {
          type: 'function',
          name: 'transfer',
          stateMutability: 'nonpayable',
          inputs: [{ name: 'to', type: 'address' }],
          outputs: [],
        },
      ] as const
      const { transport } = createMockTransport({ responses: {} })
      const client = createPublicClient({ transport }).extend(walletActions)
      const contract = getContract({
        abi: writeOnlyAbi,
        address: contractAddress,
        client,
      })
      expect('read' in contract).toBe(false)
      expect('write' in contract).toBe(true)
    })
  })

  describe('getEvents', () => {
    const transferTopic =
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
    const rawLog = {
      address: '0x0123456789abcdef0123456789abcdef01234567',
      blockHash: `0x${'0'.repeat(54)}3e8a947c68`,
      blockNumber: '0x3e8a947',
      data: '0x0000000000000000000000000000000000000000000000000000000000736201',
      logIndex: '0x0',
      removed: false,
      topics: [
        transferTopic,
        '0x0000000000000000000000001975fbea3496424a88de2a147d76baa34a3d1b93',
        '0x000000000000000000000000c3abfbceb364febe625662a9af6add366df58f81',
      ],
      transactionHash: `0x${'ab'.repeat(32)}`,
      transactionIndex: '0x1',
    }

    test('dispatches to getLogs against the JSON-RPC bridge', async () => {
      const { transport, calls } = createMockTransport({
        responses: {
          '/jsonrpc': { response: { jsonrpc: '2.0', id: 1, result: [rawLog] } },
        },
      })
      const client = createPublicClient({ transport })
      const contract = getContract({
        abi: trc20Abi,
        address: contractAddress,
        client,
      })
      expect('getEvents' in contract).toBe(true)

      const logs = await contract.getEvents.Transfer({
        fromBlock: 1n,
        toBlock: 'latest',
      })
      expect(logs).toHaveLength(1)
      expect(logs[0]?.eventName).toBe('Transfer')
      expect(logs[0]?.args).toEqual({
        from: 'TCHqEXgJzVv4X5mv4PNsFzD666wswQ2YkQ',
        to: 'TTopo6cMBAReiVe11nYcbPj6HqsJrtpmFg',
        value: 7_561_729n,
      })

      const call = calls[0]
      expect(call?.node).toBe('full')
      expect(call?.method).toBe('POST')
      expect(call?.path).toBe('/jsonrpc')
      const [filter] = (call?.body as { params: unknown[] }).params
      expect(filter).toEqual({
        address: '0x0123456789abcdef0123456789abcdef01234567',
        topics: [transferTopic],
        fromBlock: '0x1',
        toBlock: 'latest',
      })
    })

    test('rejects for an event name missing from the ABI', async () => {
      const { transport } = createMockTransport({ responses: {} })
      const client = createPublicClient({ transport })
      const contract = getContract({
        abi: trc20Abi,
        address: contractAddress,
        client,
      })
      const err = (await (
        contract.getEvents as Record<string, () => Promise<unknown>>
      ).Missing!().catch((e) => e)) as Error
      expect(err).toBeInstanceOf(AbiEventNotFoundError)
      expect(err.message).toContain('Event "Missing" not found on ABI.')
    })

    test('rejects for an overloaded event name', async () => {
      // ERC-20-style + ERC-721-style Transfer (same name, different layout):
      // the facade cannot know which overload to filter on.
      const overloadedAbi = [
        {
          type: 'event',
          name: 'Transfer',
          inputs: [
            { indexed: true, name: 'from', type: 'address' },
            { indexed: true, name: 'to', type: 'address' },
            { indexed: false, name: 'value', type: 'uint256' },
          ],
        },
        {
          type: 'event',
          name: 'Transfer',
          inputs: [
            { indexed: true, name: 'from', type: 'address' },
            { indexed: true, name: 'to', type: 'address' },
            { indexed: true, name: 'tokenId', type: 'uint256' },
          ],
        },
      ] as const
      const { transport } = createMockTransport({ responses: {} })
      const client = createPublicClient({ transport })
      const contract = getContract({
        abi: overloadedAbi,
        address: contractAddress,
        client,
      })

      const err = (await contract.getEvents.Transfer().catch((e) => e)) as Error
      expect(err).toBeInstanceOf(AbiEventOverloadError)
      expect(err.message).toContain(
        'Event "Transfer" is overloaded on the ABI.',
      )
      // Both overload signatures are spelled out for the caller.
      expect(err.message).toContain('Transfer(address,address,uint256)')
    })

    test('getEvents.<Event> forwards args / strict / blockHash to getLogs', async () => {
      let captured: unknown
      const { transport } = createMockTransport({ responses: {} })
      const client = createPublicClient({ transport }).extend(() => ({
        getLogs: async (parameters: unknown) => {
          captured = parameters
          return []
        },
      }))
      const contract = getContract({
        abi: trc20Abi,
        address: contractAddress,
        client,
      })

      const blockHash = `0x${'ab'.repeat(32)}` as const
      await contract.getEvents.Transfer({
        args: { from: holder },
        strict: true,
        blockHash,
      })
      expect(captured).toMatchObject({
        address: contractAddress,
        args: { from: holder },
        strict: true,
        blockHash,
      })
      // The facade resolves the concrete event from the ABI before dispatch.
      expect((captured as { event: { name: string } }).event.name).toBe(
        'Transfer',
      )
    })
  })

  describe('getFunctionParameters', () => {
    test('array first value is treated as args', () => {
      expect(getFunctionParameters([[holder], { account: holder }])).toEqual({
        args: [holder],
        options: { account: holder },
      })
    })
    test('non-array first value is treated as options', () => {
      expect(getFunctionParameters([{ account: holder }])).toEqual({
        args: [],
        options: { account: holder },
      })
    })
    test('empty call yields empty args and options', () => {
      expect(getFunctionParameters([])).toEqual({ args: [], options: {} })
    })
  })
})
