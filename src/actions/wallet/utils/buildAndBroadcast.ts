import type { TronAccount } from '../../../accounts/types.js'
import type { SignTransactionErrorType } from '../../../accounts/utils/signTransaction.js'
import type { Client } from '../../../clients/createClient.js'
import type { ErrorType } from '../../../errors/utils.js'
import { getAction } from '../../../utils/getAction.js'
import type { RawContract } from '../../../utils/transaction/serializeRawData.js'
import {
  type BroadcastTransactionErrorType,
  broadcastTransaction,
} from '../broadcastTransaction.js'
import {
  type BuildTransactionErrorType,
  buildTransaction,
  type MemoInput,
  type TransactionHeader,
} from './buildTransaction.js'

export type BuildAndBroadcastParameters = {
  /** The single `Transaction.Contract` to wrap in the transaction. */
  contract: RawContract
  /** The signing account (already resolved and parsed). */
  account: TronAccount
  /**
   * A pre-derived TaPoS + timing {@link TransactionHeader}. When supplied the
   * node is not queried for the latest block and these fields are used verbatim;
   * otherwise the header is derived from the latest block's own timestamp.
   */
  blockHeader?: TransactionHeader | undefined
  /** Energy/bandwidth fee ceiling in SUN (`raw_data.fee_limit`). */
  feeLimit?: bigint | undefined
  /**
   * Optional memo written to `raw_data.data` (hex or raw bytes). Enters the
   * signed bytes; the chain charges a memo fee (`getMemoFee`, 1 TRX).
   *
   * If provided, the memo must not be empty; empty memos are rejected in
   * `buildTransaction`.
   */
  memo?: MemoInput | undefined
  /**
   * Transaction lifetime in ms (see `BuildTransactionParameters.expirationMs`).
   * Ignored when a complete `blockHeader` is supplied. @default 60_000
   */
  expirationMs?: bigint | number | undefined
}
export type BuildAndBroadcastReturnType = {
  /** The locally computed transaction id (the model's `txID` spelling). */
  txID: string
  /** The node's acknowledgement flag (`true` here — a rejection throws). */
  result?: boolean | undefined
  /** The node's response code, when echoed (e.g. `SUCCESS`). */
  code?: string | undefined
  /** The node's message, hex-decoded to UTF-8 when decodable. */
  message?: string | undefined
}

export type BuildAndBroadcastErrorType =
  | BroadcastTransactionErrorType
  | BuildTransactionErrorType
  | SignTransactionErrorType
  | ErrorType

/**
 * The shared TRON write pipeline extracted from `sendTrx` / `writeContract`:
 * {@link buildTransaction} the contract into an unsigned transaction, sign it
 * locally (the account recomputes the `txID` and runs the four sign guards),
 * then broadcast. The node is used only to fetch the latest block and to
 * broadcast; the returned `txID` is the locally computed one.
 *
 * Timing is chain-derived (from the latest block's timestamp), never the local
 * wall clock; pass `blockHeader` to build fully offline against a pinned block.
 *
 * @param client The Client to use.
 * @param parameters The built contract, signing account, optional header/fee.
 * @returns `{ txID, result, code, message }` — the locally computed
 * transaction id plus the node's acknowledgement fields, when echoed.
 */
export async function buildAndBroadcast(
  client: Client,
  parameters: BuildAndBroadcastParameters,
): Promise<BuildAndBroadcastReturnType> {
  const { contract, account, feeLimit, memo, blockHeader, expirationMs } =
    parameters

  // Build the unsigned transaction (block header filled, txID computed locally).
  const unsigned = await buildTransaction(client, {
    contract,
    feeLimit,
    memo,
    blockHeader,
    expirationMs,
  })

  // Sign locally (recomputes txID, owner guard, txCheck, appends sig).
  const signed = account.signTransaction(unsigned)

  // Broadcast; the local txID is authoritative. The acknowledgement's `txid`
  // is that same local id (broadcastTransaction never reads the node's echo),
  // so it is returned once, under the model's `txID` spelling; the node's
  // other acknowledgement fields (`result`, `code`, `message`) ride along.
  const { txid: _, ...acknowledgement } = await getAction(
    client,
    broadcastTransaction,
    'broadcastTransaction',
  )({ signedTransaction: signed })

  return { txID: signed.txID, ...acknowledgement }
}
