import { afterEach, describe, expect, test, vi } from 'vitest'

import type { Client } from '../../../src/clients/createClient.js'
import {
  TronRpcError,
  WaitForTransactionReceiptTimeoutError,
} from '../../../src/errors/rpc.js'
import { waitForTransactionReceipt } from '../../../src/actions/public/waitForTransactionReceipt.js'

/** A minimal Client whose actions are provided via `overrides` (getAction). */
function makeClient(overrides: Record<string, unknown>): Client {
  return {
    account: undefined,
    cacheTime: 1000,
    chain: undefined,
    key: 'public',
    name: 'Public Client',
    pollingInterval: 1000,
    request: async () => {
      throw new Error('request should not be called')
    },
    transport: {},
    type: 'publicClient',
    uid: 'test',
    ...overrides,
  } as unknown as Client
}

/** A getter that yields queued values, sticking on the last, counting calls. */
function queued<T>(values: readonly T[]): { fn: () => T; count: () => number } {
  let i = 0
  return {
    fn: () => values[Math.min(i++, values.length - 1)] as T,
    count: () => i,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('waitForTransactionReceipt', () => {
  test('polls getTransactionInfo until the receipt is packed', async () => {
    vi.useFakeTimers()
    const receipt = { id: 'abc', blockNumber: 100, status: 'success' as const }
    const info = queued([null, null, receipt])
    const client = makeClient({ getTransactionInfo: info.fn })

    const promise = waitForTransactionReceipt(client, {
      hash: 'abc',
      pollingInterval: 1000,
      timeout: 60_000,
    })
    await vi.advanceTimersByTimeAsync(2000)

    expect(await promise).toBe(receipt)
    expect(info.count()).toBe(3)
  })

  test('treats an empty {} receipt as still pending', async () => {
    vi.useFakeTimers()
    const receipt = { id: 'e', blockNumber: 1, status: 'success' as const }
    const info = queued([{}, receipt])
    const client = makeClient({ getTransactionInfo: info.fn })

    const promise = waitForTransactionReceipt(client, {
      hash: 'e',
      pollingInterval: 1000,
    })
    await vi.advanceTimersByTimeAsync(1000)

    expect(await promise).toBe(receipt)
  })

  test('rejects with a timeout error once the deadline passes', async () => {
    vi.useFakeTimers()
    const info = queued([null]) // never resolves to a receipt
    const client = makeClient({ getTransactionInfo: info.fn })

    const promise = waitForTransactionReceipt(client, {
      hash: 'dead',
      pollingInterval: 1000,
      timeout: 5000,
    })
    const assertion = expect(promise).rejects.toBeInstanceOf(
      WaitForTransactionReceiptTimeoutError,
    )
    await vi.advanceTimersByTimeAsync(10_000)
    await assertion
  })

  test('waits for the requested confirmations via getNowBlock', async () => {
    vi.useFakeTimers()
    const receipt = { id: 'x', blockNumber: 100, status: 'success' as const }
    const info = queued([receipt])
    const blocks = queued([{ number: 100 }, { number: 101 }, { number: 102 }])
    const client = makeClient({
      getTransactionInfo: info.fn,
      getNowBlock: blocks.fn,
    })

    const promise = waitForTransactionReceipt(client, {
      hash: 'x',
      confirmations: 2,
      pollingInterval: 1000,
      timeout: 60_000,
    })
    await vi.advanceTimersByTimeAsync(2000)

    expect(await promise).toBe(receipt)
    expect(blocks.count()).toBe(3)
  })

  test('does not throw on a reverted receipt by default', async () => {
    const receipt = { id: 'r', blockNumber: 5, status: 'reverted' as const }
    const client = makeClient({ getTransactionInfo: queued([receipt]).fn })

    expect(await waitForTransactionReceipt(client, { hash: 'r' })).toBe(receipt)
  })

  test('throws when throwOnRevert is set and the receipt reverted', async () => {
    const receipt = { id: 'r', blockNumber: 5, status: 'reverted' as const }
    const client = makeClient({ getTransactionInfo: queued([receipt]).fn })

    await expect(
      waitForTransactionReceipt(client, { hash: 'r', throwOnRevert: true }),
    ).rejects.toBeInstanceOf(TronRpcError)
  })
})
