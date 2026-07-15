import { describe, expect, test } from 'vitest'

import { rpc } from '../../test/fixtures/rpc/loader.js'
import { createMockTransport } from '../../test/mock/createMockTransport.js'
import { parseBroadcast } from '../../test/mock/parseBroadcast.js'
import { privateKeyToAccount } from '../accounts/privateKeyToAccount.js'
import { createPublicClient } from '../clients/createPublicClient.js'
import { createWalletClient } from '../clients/createWalletClient.js'
import { walletActions } from '../clients/decorators/wallet.js'
import type { Address } from '../types/address.js'
import { getContract, getFunctionParameters } from './getContract.js'

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

const contractAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' as Address
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

      const balance = await contract.read.balanceOf([holder])
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

      const result = await contract.read.balanceOf([holder], { from: holder })
      expect(result).toBe(7n)
      expect(captured).toMatchObject({
        abi: trc20Abi,
        address: contractAddress,
        functionName: 'balanceOf',
        args: [holder],
        from: holder,
      })
    })

    test('read.<fn> with no args treats the first argument as options', async () => {
      let captured: { args: readonly unknown[]; from?: Address } | undefined
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

      await contract.read.totalSupply({ from: holder })
      expect(captured?.args).toEqual([])
      expect(captured?.from).toBe(holder)
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
          broadcasthex: { response: { result: true } },
        },
      })
      const client = createWalletClient({ transport, account })
      const contract = getContract({
        abi: trc20Abi,
        address: contractAddress,
        client,
      })

      const result = await contract.write.transfer([holder, 1000n], {
        now: 1_700_000_000_000n,
      })

      // Local txID is authoritative and deterministic (fixed block + `now`).
      expect(result.txID).toMatch(/^[0-9a-f]{64}$/)
      // Both node round-trips happened: fetch block, then broadcast.
      expect(calls.map((c) => c.path)).toEqual(['getnowblock', 'broadcasthex'])
      // The broadcast body is the whole signed transaction.
      const body = parseBroadcast(bodyOf('broadcasthex')) as {
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
    test('dispatches to getContractEvents against the /v1 event index', async () => {
      const rawEvent = {
        block_number: 1,
        block_timestamp: 1_700_000_000_000,
        contract_address: contractAddress,
        event_index: 0,
        event_name: 'Transfer',
        result: {
          from: '0xafb6ccdb345bc36c69a618b66c1693f36213622b',
          to: '0x2e5531459778bee382355ab73bc93ee763f5ed94',
          value: '5',
        },
        result_type: { from: 'address', to: 'address', value: 'uint256' },
        transaction_id: 'ab'.repeat(32),
      }
      const { transport, calls } = createMockTransport({
        responses: {},
        onUnmatched: {
          response: { data: [rawEvent], success: true, meta: { page_size: 1 } },
        },
      })
      const client = createPublicClient({ transport })
      const contract = getContract({
        abi: trc20Abi,
        address: contractAddress,
        client,
      })
      expect('getEvents' in contract).toBe(true)

      const { events } = await contract.getEvents.Transfer({
        onlyConfirmed: true,
        limit: 50,
      })
      expect(events).toHaveLength(1)
      expect(events[0]?.eventName).toBe('Transfer')
      expect(events[0]?.args.value).toBe(5n)

      const call = calls[0]
      expect(call?.node).toBe('event')
      expect(call?.method).toBe('GET')
      expect(call?.path).toContain(`/v1/contracts/${contractAddress}/events`)
      expect(call?.path).toContain('event_name=Transfer')
      expect(call?.path).toContain('only_confirmed=true')
    })
  })

  describe('getFunctionParameters', () => {
    test('array first value is treated as args', () => {
      expect(getFunctionParameters([[holder], { from: holder }])).toEqual({
        args: [holder],
        options: { from: holder },
      })
    })
    test('non-array first value is treated as options', () => {
      expect(getFunctionParameters([{ from: holder }])).toEqual({
        args: [],
        options: { from: holder },
      })
    })
    test('empty call yields empty args and options', () => {
      expect(getFunctionParameters([])).toEqual({ args: [], options: {} })
    })
  })
})
