import { afterEach, describe, expect, test, vi } from 'vitest'
import { waitForTransactionReceipt } from '../../../src/actions/public/waitForTransactionReceipt.js'
import type { Client } from '../../../src/clients/createClient.js'
import {
  TronRpcError,
  WaitForTransactionReceiptTimeoutError,
} from '../../../src/errors/rpc.js'

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

    // The mining block (100) is confirmation 1, so confirmations:2 resolves at
    // head 101 — one block on top — polling getNowBlock twice (100, 101).
    expect(await promise).toBe(receipt)
    expect(blocks.count()).toBe(2)
  })

  // The old `?? 0` fallback made a blockNumber-less receipt look `head` blocks
  // deep, so any confirmation count passed instantly — the failure direction
  // must be a loud error, not a pass. Every row is a distinct bypass of a
  // weaker guard: `null === undefined` is false but `Number(null)` is 0; a
  // `-1` not-found sentinel is truthy yet counts as `head + 2` deep; `true`
  // coerces to block 1; the string "0" is what a spec-conformant proto3-JSON
  // re-serializer emits for an int64 default.
  test.each([
    ['missing', { id: 'nb', status: 'success' as const }],
    ['null', { id: 'nb', blockNumber: null, status: 'success' as const }],
    ['zero', { id: 'nb', blockNumber: 0, status: 'success' as const }],
    ['negative', { id: 'nb', blockNumber: -1, status: 'success' as const }],
    ['boolean', { id: 'nb', blockNumber: true, status: 'success' as const }],
    ['string', { id: 'nb', blockNumber: '0', status: 'success' as const }],
  ])('rejects a %s receipt blockNumber (confirmations > 1)', async (_, receipt) => {
    const blocks = queued([{ number: 62_000_000 }])
    const client = makeClient({
      getTransactionInfo: queued([receipt]).fn,
      getNowBlock: blocks.fn,
    })

    const err = (await waitForTransactionReceipt(client, {
      hash: 'nb',
      confirmations: 20,
    }).catch((e) => e)) as TronRpcError
    expect(err).toBeInstanceOf(TronRpcError)
    expect(err.message).toContain('does not carry a usable blockNumber')
    // It must throw before consulting the chain head at all.
    expect(blocks.count()).toBe(0)
  })

  test('rejects when the head block carries no number', async () => {
    const receipt = { id: 'hb', blockNumber: 100, status: 'success' as const }
    const client = makeClient({
      getTransactionInfo: queued([receipt]).fn,
      getNowBlock: queued([{}]).fn,
    })

    // The short timeout is a regression tripwire: pre-guard code treated a
    // number-less head as 0 and polled to the wait deadline, so a regression
    // surfaces here in ~0.5s as a WaitForTransactionReceiptTimeoutError
    // failing the instanceof assertion (instead of stalling toward vitest's
    // own test timeout).
    const err = (await waitForTransactionReceipt(client, {
      hash: 'hb',
      confirmations: 2,
      pollingInterval: 50,
      timeout: 500,
    }).catch((e) => e)) as TronRpcError
    expect(err).toBeInstanceOf(TronRpcError)
    expect(err.message).toContain('block without a usable number')
  })

  // The guard is scoped to confirmations > 1 on purpose: at the default depth
  // of 1 the receipt's mere existence is the answer and blockNumber is never
  // read (the built-in getTransactionInfo validates its own responses; this
  // boundary only matters for Client overrides).
  test('confirmations: 1 resolves without reading blockNumber', async () => {
    const receipt = { id: 'c1', status: 'success' as const }
    const client = makeClient({ getTransactionInfo: queued([receipt]).fn })

    expect(await waitForTransactionReceipt(client, { hash: 'c1' })).toBe(
      receipt,
    )
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
