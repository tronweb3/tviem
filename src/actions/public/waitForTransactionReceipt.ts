import type { Client } from '../../clients/createClient.js'
import {
  TronRpcError,
  WaitForTransactionReceiptTimeoutError,
} from '../../errors/rpc.js'
import { getAction } from '../../utils/getAction.js'
import { getNowBlock } from './getNowBlock.js'
import { getTransactionInfo } from './getTransactionInfo.js'

export type WaitForTransactionReceiptParameters = {
  /** The transaction id to wait on. */
  hash: string
  /**
   * Block depth to wait for on top of the receipt's block, using the node
   * formula `nowBlock.number - receipt.blockNumber >= confirmations`. A value of
   * `1` (default) returns as soon as the receipt is available.
   */
  confirmations?: number | undefined
  /** Max time (in ms) to wait before timing out. @default 60_000 */
  timeout?: number | undefined
  /**
   * Poll interval (in ms) between receipt checks. Defaults to the Client's
   * `pollingInterval`. Injectable so tests can drive fake timers.
   */
  pollingInterval?: number | undefined
  /**
   * Reject with a {@link TronRpcError} when the receipt's `status` is
   * `'reverted'`. @default false
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

/** Resolves after `ms` milliseconds (timer-based, so fake timers can drive it). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Whether a `getTransactionInfo` result means the tx is not yet packed. */
function isPending(receipt: unknown): boolean {
  if (receipt === null || receipt === undefined) return true
  if (typeof receipt === 'object' && Object.keys(receipt).length === 0)
    return true
  return false
}

/**
 * Polls `getTransactionInfo` until the transaction is packed into a block, then
 * (optionally) polls `getNowBlock` until the requested block depth is reached.
 *
 * A `null`/empty receipt means "not yet packed": the poller waits
 * `pollingInterval` and retries. Exceeding `timeout` rejects with a
 * {@link WaitForTransactionReceiptTimeoutError}. A `'reverted'` status does
 * **not** reject unless `throwOnRevert` is set. Both the receipt lookup and the
 * confirmation lookup go through {@link getAction}, so a Client may override
 * either.
 */
export async function waitForTransactionReceipt(
  client: Client,
  parameters: WaitForTransactionReceiptParameters,
): Promise<WaitForTransactionReceiptReturnType> {
  const { hash, confirmations = 1, throwOnRevert = false } = parameters
  const timeout = parameters.timeout ?? 60_000
  const pollingInterval = parameters.pollingInterval ?? client.pollingInterval

  const getReceipt = getAction(client, getTransactionInfo, 'getTransactionInfo')
  const getBlock = getAction(client, getNowBlock, 'getNowBlock')

  const start = Date.now()
  const assertNotTimedOut = () => {
    if (Date.now() - start > timeout)
      throw new WaitForTransactionReceiptTimeoutError({ hash })
  }

  // Phase 1 — wait for the receipt to be packed.
  let receipt = await getReceipt({ hash })
  while (isPending(receipt)) {
    assertNotTimedOut()
    await sleep(pollingInterval)
    assertNotTimedOut()
    receipt = await getReceipt({ hash })
  }

  const packed = receipt as TransactionReceipt

  // Phase 2 — wait for the requested block depth.
  if (confirmations > 1) {
    const receiptBlock = Number(packed.blockNumber ?? 0)
    while (true) {
      const now = (await getBlock(undefined as never)) as {
        number?: number | bigint
      } | null
      const head = Number(now?.number ?? 0)
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
    throw new TronRpcError(`Transaction "${hash}" reverted.`)

  return packed
}
