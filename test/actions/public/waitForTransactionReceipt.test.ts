import { afterEach, describe, expect, test, vi } from 'vitest'
import { waitForTransactionReceipt } from '../../../src/actions/public/waitForTransactionReceipt.js'
import type { Client } from '../../../src/clients/createClient.js'
import {
  TransactionRevertedError,
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

  // Opting into the throw must not cost the caller the revert data: a revert
  // is not an RPC failure, and the receipt carries why it failed and what it
  // burned, so the error carries the receipt rather than discarding it.
  test('throws when throwOnRevert is set and the receipt reverted', async () => {
    const receipt = {
      id: 'r',
      blockNumber: 5,
      status: 'reverted' as const,
      contractResult: ['08c379a0'],
      energyFee: 1_000n,
    }
    const client = makeClient({ getTransactionInfo: queued([receipt]).fn })

    const err = (await waitForTransactionReceipt(client, {
      hash: 'r',
      throwOnRevert: true,
    }).catch((e) => e)) as TransactionRevertedError
    expect(err).toBeInstanceOf(TransactionRevertedError)
    // Not an RPC failure — the call succeeded and returned a valid receipt.
    expect(err).not.toBeInstanceOf(TronRpcError)
    expect(err.shortMessage).toBe('Transaction "r" reverted.')
    expect(err.receipt).toBe(receipt)
  })
})

// The node role is passed explicitly on every call rather than inherited from
// getTransactionInfo / getNowBlock's own defaults, so it stays a property of
// the poller. Both phases must agree: a solidified receipt block compared
// against an unsolidified head would start the depth count already deep in.
describe('waitForTransactionReceipt node selection', () => {
  const receipt = { id: 'abc', blockNumber: 100, status: 'success' as const }

  /** Records the parameters each polled action was called with. */
  function spy<T>(value: T): {
    fn: (parameters: unknown) => T
    calls: unknown[]
  } {
    const calls: unknown[] = []
    return {
      fn: (parameters: unknown) => {
        calls.push(parameters)
        return value
      },
      calls,
    }
  }

  // Unlike the individual read actions, which default to the head, the poller
  // gates whatever irreversible step follows it, so it waits for solidified
  // state unless the caller opts out.
  test('polls the SolidityNode by default, on both phases', async () => {
    const info = spy(receipt)
    const blocks = spy({ number: 101 })
    const client = makeClient({
      getTransactionInfo: info.fn,
      getNowBlock: blocks.fn,
    })

    await waitForTransactionReceipt(client, { hash: 'abc', confirmations: 2 })

    expect(info.calls[0]).toEqual({ hash: 'abc', confirmed: true })
    expect(blocks.calls[0]).toEqual({ confirmed: true })
  })

  test('confirmed: false routes both phases to the FullNode', async () => {
    const info = spy(receipt)
    const blocks = spy({ number: 101 })
    const client = makeClient({
      getTransactionInfo: info.fn,
      getNowBlock: blocks.fn,
    })

    await waitForTransactionReceipt(client, {
      hash: 'abc',
      confirmations: 2,
      confirmed: false,
    })

    expect(info.calls[0]).toEqual({ hash: 'abc', confirmed: false })
    expect(blocks.calls[0]).toEqual({ confirmed: false })
  })

  // A real transaction is never packed by the time of the first poll, so the
  // retry is the common path: it must carry the node role too, or the default
  // mode silently polls the SolidityNode and cannot see a receipt until it
  // solidifies.
  test.each([
    [false],
    [true],
  ])('every repeat poll carries confirmed: %s', async (confirmed) => {
    vi.useFakeTimers()
    const calls: unknown[] = []
    const values = [null, null, receipt]
    let i = 0
    const client = makeClient({
      getTransactionInfo: (parameters: unknown) => {
        calls.push(parameters)
        return values[Math.min(i++, values.length - 1)]
      },
    })

    const promise = waitForTransactionReceipt(client, {
      hash: 'abc',
      confirmed,
      pollingInterval: 1000,
    })
    await vi.advanceTimersByTimeAsync(2000)
    await promise

    expect(calls).toHaveLength(3)
    for (const call of calls) expect(call).toEqual({ hash: 'abc', confirmed })
  })

  // The deadline covers the depth wait too, not just the receipt wait: with a
  // head that never advances, phase 2 must reject rather than poll forever.
  // Nothing else can break that loop, so dropping the check leaves the promise
  // pending — hence the tight per-test timeout, which turns the stall into a
  // ~1s failure instead of a wait on vitest's own default.
  test('the timeout also fires while waiting for confirmations', async () => {
    vi.useFakeTimers()
    const stuck = makeClient({
      getTransactionInfo: () => receipt,
      getNowBlock: () => ({ number: 100 }),
    })

    const promise = waitForTransactionReceipt(stuck, {
      hash: 'abc',
      confirmations: 5,
      timeout: 5_000,
      pollingInterval: 1000,
    }).catch((err) => err)
    await vi.advanceTimersByTimeAsync(6_000)

    expect(await promise).toBeInstanceOf(WaitForTransactionReceiptTimeoutError)
  }, 1000)

  test('an explicit timeout wins over the mode default', async () => {
    vi.useFakeTimers()
    const client = makeClient({ getTransactionInfo: () => null })

    const promise = waitForTransactionReceipt(client, {
      hash: 'abc',
      timeout: 10_000,
      pollingInterval: 1000,
    }).catch((err) => err)
    // Well inside the 90_000 default: only the explicit value can fire.
    await vi.advanceTimersByTimeAsync(11_000)

    expect(await promise).toBeInstanceOf(WaitForTransactionReceiptTimeoutError)
  })

  // One budget for both modes, sized for the longer of the two (solidified).
  // Both bounds are pinned in each mode: the upper bound alone would pass with
  // any budget at all, down to 0, and the lower alone with any budget at all.
  test.each([
    [true],
    [false],
  ])('the default timeout is 90s with confirmed: %s', async (confirmed) => {
    vi.useFakeTimers()

    /** Whether a promise has settled, after flushing pending microtasks. */
    const isSettled = async (promise: Promise<unknown>) => {
      let settled = false
      void promise.then(() => {
        settled = true
      })
      await vi.advanceTimersByTimeAsync(0)
      return settled
    }

    const client = makeClient({ getTransactionInfo: () => null })
    const promise = waitForTransactionReceipt(client, {
      hash: 'abc',
      confirmed,
      pollingInterval: 1000,
    }).catch((err) => err)

    await vi.advanceTimersByTimeAsync(89_000)
    expect(await isSettled(promise)).toBe(false)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(await promise).toBeInstanceOf(WaitForTransactionReceiptTimeoutError)
  })
})
