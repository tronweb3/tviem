import type { Client } from '../../clients/createClient.js'
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import {
  TransactionRevertedError,
  type TransactionRevertedErrorType,
  TronRpcError,
  type TronRpcErrorType,
  WaitForTransactionReceiptTimeoutError,
  type WaitForTransactionReceiptTimeoutErrorType,
} from '../../errors/rpc.js'
import type { ErrorType } from '../../errors/utils.js'
import { getAction } from '../../utils/getAction.js'
import { type GetNowBlockErrorType, getNowBlock } from './getNowBlock.js'
import {
  type GetTransactionInfoErrorType,
  getTransactionInfo,
} from './getTransactionInfo.js'

export type WaitForTransactionReceiptParameters = {
  /** The transaction id to wait on. */
  hash: string
  /**
   * Block depth to wait for, where the mining block itself counts as the first
   * confirmation: `head - receipt.blockNumber + 1 >= confirmations`. A value of
   * `1` (default) returns as soon as the receipt is available. Each further
   * confirmation costs one block of waiting, and block depth is only a proxy
   * for irreversibility — for the real thing use `confirmed`.
   */
  confirmations?: number | undefined
  /**
   * Wait for a solidified (irreversible) receipt, reading both it and the
   * confirmation head from the SolidityNode. Solidification trails the chain
   * head, so this waits considerably longer than packing does.
   *
   * Pass `false` to resolve as soon as the transaction is packed, reading both
   * from the FullNode. That is enough to learn the execution outcome —
   * `status`, the energy and fee actually burned, `contractResult`, `logs` —
   * but the block it landed in can still be reorganized away. With
   * `confirmations > 1` the inclusion block is read once at packing and the
   * depth is counted from it without re-reading the receipt, so a reorg after
   * packing is not re-checked while counting (a SolidityNode receipt cannot
   * reorg, so `confirmed: true` is unaffected). @default true
   */
  confirmed?: boolean | undefined
  /**
   * Max time (in ms) to wait before timing out — the same budget in both
   * modes, sized to cover packing plus solidification. Raise it when the send
   * raised `expirationMs` (the poller holds only a hash and cannot derive that
   * lifetime), or when a congested chain is packing slowly enough that the
   * timeout fires on transactions that do eventually land. @default 90_000
   */
  timeout?: number | undefined
  /**
   * Poll interval (in ms) between receipt checks. Defaults to the Client's
   * `pollingInterval`. Injectable so tests can drive fake timers.
   */
  pollingInterval?: number | undefined
  /**
   * Reject with a {@link TransactionRevertedError} when the receipt's `status`
   * is `'reverted'`. The receipt is carried on the error's `receipt` property,
   * so the revert data is not lost by opting into the throw. @default false
   */
  throwOnRevert?: boolean | undefined
}

/** The resolved transaction receipt (a subset of `TransactionInfo`). */
export type TransactionReceipt = {
  /** The transaction id. */
  id?: string
  /** The number of the block the transaction was included in. */
  blockNumber?: number | bigint
  /** Execution status. */
  status?: 'success' | 'reverted'
  [key: string]: unknown
}
export type WaitForTransactionReceiptReturnType = TransactionReceipt

export type WaitForTransactionReceiptErrorType =
  | BaseErrorType
  | GetNowBlockErrorType
  | GetTransactionInfoErrorType
  | TransactionRevertedErrorType
  | TronRpcErrorType
  | WaitForTransactionReceiptTimeoutErrorType
  | ErrorType

/** Whether a `getTransactionInfo` result means the tx is not yet packed. */
function isPending(receipt: unknown): boolean {
  if (receipt === null || receipt === undefined) return true
  if (typeof receipt === 'object' && Object.keys(receipt).length === 0)
    return true
  return false
}

/**
 * Coerces a block number to a positive safe integer, or `NaN` when it is not
 * one. A packed transaction lives in a positive block, so absent, `null`, 0,
 * negative and non-numeric values are all rejected alike — any of them,
 * coerced, would corrupt the depth formula (`Number(null)` is 0; a `-1`
 * sentinel would count as `head + 2` confirmations deep).
 */
function toBlockNumber(value: unknown): number {
  const n =
    typeof value === 'bigint'
      ? Number(value)
      : typeof value === 'number'
        ? value
        : Number.NaN
  return Number.isSafeInteger(n) && n > 0 ? n : Number.NaN
}

/**
 * Polls `getTransactionInfo` until the transaction is packed into a block, then
 * (optionally) polls `getNowBlock` until the requested block depth is reached.
 *
 * Both reads go to the SolidityNode, so what resolves is a receipt that can no
 * longer be reverted — the poller is a one-shot gate for whatever irreversible
 * step follows it, and solidification is what that costs. This is deliberately
 * not the rule the individual read actions follow: a `getBalance` is repeated,
 * transient and self-correcting, so it reads the head, whereas a receipt that
 * evaporates after the caller acted on it announces itself to nobody.
 *
 * `confirmed: false` routes both reads to the FullNode instead and resolves
 * within a block or two of broadcast, which is enough to learn the execution
 * outcome a broadcast cannot report: `status`, the energy and fee actually
 * burned, `contractResult`, `logs`. The node role is passed explicitly on
 * every call, so it stays a property of this poller rather than of another
 * action's default.
 *
 * A `null`/empty receipt means "not yet packed": the poller waits
 * `pollingInterval` and retries. `timeout` is a wall-clock deadline: when it
 * passes the promise rejects with a
 * {@link WaitForTransactionReceiptTimeoutError} even if a poll is still in
 * flight — a result arriving after the deadline is discarded. A `'reverted'` status does
 * **not** reject unless `throwOnRevert` is set. Both the receipt lookup and the
 * confirmation lookup go through {@link getAction}; overrides for either are
 * seen only when installed before the public decorator (see `getAction`).
 */
export async function waitForTransactionReceipt(
  client: Client,
  parameters: WaitForTransactionReceiptParameters,
): Promise<WaitForTransactionReceiptReturnType> {
  const {
    confirmations = 1,
    confirmed = true,
    hash,
    throwOnRevert = false,
  } = parameters
  const timeout = parameters.timeout ?? 90_000
  const pollingInterval = parameters.pollingInterval ?? client.pollingInterval

  // The caller's numbers get the same scrutiny the node's do (toBlockNumber):
  // a NaN timeout never times out, a NaN confirmations skips the confirmation
  // phase entirely, and a negative interval polls hot — each failing open.
  if (!Number.isFinite(timeout) || timeout < 0)
    throw new BaseError(
      `Invalid timeout: ${timeout}. Expected a finite, non-negative number of milliseconds.`,
    )
  if (!Number.isFinite(pollingInterval) || pollingInterval < 0)
    throw new BaseError(
      `Invalid pollingInterval: ${pollingInterval}. Expected a finite, non-negative number of milliseconds.`,
    )
  if (!Number.isSafeInteger(confirmations) || confirmations < 1)
    throw new BaseError(
      `Invalid confirmations: ${confirmations}. Expected an integer of at least 1.`,
    )

  const getReceipt = getAction(client, getTransactionInfo, 'getTransactionInfo')
  const getBlock = getAction(client, getNowBlock, 'getNowBlock')

  const start = Date.now()
  // `settled` makes the in-loop termination exact: once the race has resolved
  // either way, the background poll stops at its next boundary even when the
  // wall clock reads exactly `timeout`.
  let settled = false
  const assertNotTimedOut = () => {
    if (settled || Date.now() - start > timeout)
      throw new WaitForTransactionReceiptTimeoutError({ hash })
  }

  // Interruptible sleep: `finally` below cancels a pending one, so a lost
  // race leaves no stray timer holding the process for up to a full
  // pollingInterval — the woken loop hits assertNotTimedOut and winds down
  // without another RPC. (Timer-based, so fake timers can drive it.)
  let cancelSleep: (() => void) | undefined
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        cancelSleep = undefined
        resolve()
      }, ms)
      cancelSleep = () => {
        clearTimeout(t)
        cancelSleep = undefined
        resolve()
      }
    })

  async function poll(): Promise<WaitForTransactionReceiptReturnType> {
    // Phase 1 — wait for the receipt to be packed (or solidified).
    let receipt = await getReceipt({ hash, confirmed })
    while (isPending(receipt)) {
      assertNotTimedOut()
      await sleep(pollingInterval)
      assertNotTimedOut()
      receipt = await getReceipt({ hash, confirmed })
    }

    const packed = receipt as TransactionReceipt

    // Phase 2 — wait for the requested block depth. The head is read from the
    // same node as the receipt: comparing a solidified receipt block against an
    // unsolidified head would start the count already deep enough to make every
    // value up to the solidification distance a silent no-op.
    //
    // Both block numbers must be positive integers (see toBlockNumber): the
    // receipt may come from a Client override rather than getTransactionInfo,
    // and any coerced junk value corrupts the depth formula in the fail-open
    // direction — a 0 (or `null`, or `-1`) receipt block makes every receipt
    // look at least `head` blocks deep, silently passing any requested
    // confirmation count.
    //
    // `confirmations: 1` needs no head read: a packed receipt is by definition
    // already one block deep.
    if (confirmations > 1) {
      const receiptBlock = toBlockNumber(packed.blockNumber)
      if (Number.isNaN(receiptBlock))
        throw new TronRpcError(
          `The receipt for "${hash}" does not carry a usable blockNumber; confirmations cannot be counted.`,
        )
      while (true) {
        const now = (await getBlock({ confirmed })) as {
          number?: number | bigint
        } | null
        const head = toBlockNumber(now?.number)
        if (Number.isNaN(head))
          throw new TronRpcError(
            'getNowBlock returned a block without a usable number; confirmations cannot be counted.',
          )
        // The mining block counts as the first confirmation, so `confirmations`
        // is reached at depth `confirmations - 1` on top of it (N=1 resolves at
        // the receipt block itself, handled by the `> 1` fast-path above).
        if (head - receiptBlock + 1 >= confirmations) break
        assertNotTimedOut()
        await sleep(pollingInterval)
        assertNotTimedOut()
      }
    }

    if (throwOnRevert && packed.status === 'reverted')
      throw new TransactionRevertedError({ hash, receipt: packed })

    return packed
  }

  // The deadline is wall-clock: the race rejects on time even while a poll is
  // in flight (each RPC is itself bounded by the transport timeout). The
  // in-loop asserts terminate the losing poll — its late rejection is
  // absorbed by the race's own subscription.
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new WaitForTransactionReceiptTimeoutError({ hash })),
      timeout,
    )
  })
  try {
    return await Promise.race([poll(), deadline])
  } finally {
    settled = true
    clearTimeout(timer)
    cancelSleep?.()
  }
}
