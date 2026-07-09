// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { TronAccount } from '../../../accounts/types.js'
import type { Client } from '../../../clients/createClient.js'
import { getAction } from '../../../utils/getAction.js'
import { fillBlockHeader } from '../../../utils/transaction/prepareTransaction.js'
import type {
  RawContract,
  RawData,
} from '../../../utils/transaction/serializeRawData.js'
import { getNowBlock } from '../../public/getNowBlock.js'
import { broadcastTransaction } from '../broadcastTransaction.js'

export type BuildAndBroadcastParameters = {
  /** The single `Transaction.Contract` to wrap in the transaction. */
  contract: RawContract
  /** The signing account (already resolved and parsed). */
  account: TronAccount
  /** Injectable clock (ms since epoch) for deterministic tests. */
  now?: bigint | undefined
  /** Energy/bandwidth fee ceiling in SUN (`raw_data.fee_limit`). */
  feeLimit?: bigint | undefined
}
export type BuildAndBroadcastReturnType = { txID: string }

/**
 * The shared TRON write pipeline extracted from `sendTrx` / `writeContract`:
 * wrap a single already-built `RawContract` into a `raw_data` model, fill its
 * TaPoS reference fields + expiration from the latest block, sign it locally
 * (the account recomputes the `txID` and runs the four sign guards), then
 * broadcast. The node is used only to fetch the latest block and to broadcast;
 * the returned `txID` is the locally computed one.
 *
 * `now` is the single point the wall clock is read and is injectable so the
 * built bytes / `txID` are deterministic offline.
 *
 * @param client The Client to use.
 * @param parameters The built contract, signing account, optional clock/fee.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function buildAndBroadcast(
  client: Client,
  parameters: BuildAndBroadcastParameters,
): Promise<BuildAndBroadcastReturnType> {
  const { contract, account, feeLimit } = parameters

  // The only wall-clock read in the write pipeline — injectable for tests.
  const now = parameters.now ?? BigInt(Date.now())

  // Wrap the contract in the raw_data model (fee_limit only when supplied).
  let rawData: RawData = { contract: [contract], timestamp: now }
  if (feeLimit !== undefined) rawData = { ...rawData, feeLimit }

  // Fill TaPoS reference fields + expiration from the latest block.
  const block = await getAction(
    client,
    getNowBlock,
    'getNowBlock',
  )(undefined as never)
  rawData = fillBlockHeader(rawData, block, now)

  // Sign locally (recomputes txID, owner guard, txCheck, appends sig).
  const signed = account.signTransaction({ raw_data: rawData })

  // Broadcast; the local txID is authoritative.
  await getAction(
    client,
    broadcastTransaction,
    'broadcastTransaction',
  )({ signedTransaction: signed })

  return { txID: signed.txID ?? '' }
}
