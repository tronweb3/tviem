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
  /** Bare-hex `raw_data.data` payload (e.g. a transfer memo). */
  data?: string | undefined
  /**
   * Transaction lifetime in ms (see `BuildTransactionParameters.expirationMs`).
   * Ignored when a complete `blockHeader` is supplied. @default 60_000
   */
  expirationMs?: bigint | number | undefined
}
export type BuildAndBroadcastReturnType = { txID: string }

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
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function buildAndBroadcast(
  client: Client,
  parameters: BuildAndBroadcastParameters,
): Promise<BuildAndBroadcastReturnType> {
  const { contract, account, feeLimit, data, blockHeader, expirationMs } =
    parameters

  // Build the unsigned transaction (block header filled, txID computed locally).
  const unsigned = await buildTransaction(client, {
    contract,
    feeLimit,
    data,
    blockHeader,
    expirationMs,
  })

  // Sign locally (recomputes txID, owner guard, txCheck, appends sig).
  const signed = account.signTransaction(unsigned)

  // Broadcast; the local txID is authoritative.
  await getAction(
    client,
    broadcastTransaction,
    'broadcastTransaction',
  )({ signedTransaction: signed })

  return { txID: signed.txID }
}
