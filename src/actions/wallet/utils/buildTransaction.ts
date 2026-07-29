import type { SignableTransaction } from '../../../accounts/types.js'
import type { Client } from '../../../clients/createClient.js'
import { getAction } from '../../../utils/getAction.js'
import { getTransactionId } from '../../../utils/transaction/getTransactionId.js'
import { fillBlockHeader } from '../../../utils/transaction/prepareTransaction.js'
import {
  type RawContract,
  type RawData,
  toRawDataHex,
} from '../../../utils/transaction/serializeRawData.js'
import { getNowBlock } from '../../public/getNowBlock.js'

/**
 * A fully-specified TaPoS + timing header. When all four fields are supplied to
 * {@link buildTransaction} they are used verbatim and the latest block is NOT
 * fetched — mirrors TronWeb's `blockHeader` option / `checkBlockHeader`, which
 * only treats a header as an override when it is complete. Lets a caller build
 * (and diff) transactions fully offline against a pinned block.
 */
export type TransactionHeader = {
  /** `ref_block_bytes`: low 2 bytes of the block number (bare hex). */
  refBlockBytes: string
  /** `ref_block_hash`: bytes 8..16 of the block id (bare hex). */
  refBlockHash: string
  /** Expiration timestamp in ms (`raw_data.expiration`). */
  expiration: bigint | number
  /** Creation timestamp in ms (`raw_data.timestamp`). */
  timestamp: bigint | number
}

export type BuildTransactionParameters = {
  /** The single `Transaction.Contract` to wrap in the transaction. */
  contract: RawContract
  /** Energy/bandwidth fee ceiling in SUN (`raw_data.fee_limit`). */
  feeLimit?: bigint | undefined
  /** Bare-hex `raw_data.data` payload (e.g. a transfer memo). */
  data?: string | undefined
  /**
   * Multi-sig permission id (`Contract.Permission_id`). When set it is written
   * into the contract before the `txID` is derived, so the built transaction is
   * bound to that active/owner permission (mirrors {@link signTransaction}).
   */
  permissionId?: number | undefined
  /**
   * A pre-derived TaPoS + timing {@link TransactionHeader}. When supplied the
   * node is NOT queried and these fields are used verbatim (offline build);
   * otherwise the latest block is fetched and the header is derived from the
   * block's own timestamp. Mirrors TronWeb's `blockHeader` override.
   */
  blockHeader?: TransactionHeader | undefined
}

/**
 * A fully built but **unsigned** transaction: `txID` + `raw_data` +
 * `raw_data_hex`, with an empty `signature`. Ready to hand to an account's
 * `signTransaction`, to `multiSign`, or to `getSignWeight`.
 */
export type BuildTransactionReturnType = SignableTransaction

/**
 * The shared TRON build phase extracted from {@link buildAndBroadcast}: wrap a
 * single already-built `RawContract` into a `raw_data` model, attach `fee_limit`
 * / `data` when supplied, fill its TaPoS reference fields + `timestamp` +
 * `expiration`, then locally compute the `txID` and `raw_data_hex`. Nothing is
 * signed or broadcast.
 *
 * Timing is chain-derived, never wall-clock: when `blockHeader` is supplied it
 * is used verbatim (fully offline build); otherwise the latest block is fetched
 * and the `timestamp` / `expiration` come from the block's own timestamp. This
 * mirrors TronWeb's `createTransaction` and keeps a skewed client clock from
 * minting an already-expired transaction.
 *
 * @param client The Client to use.
 * @param parameters The built contract, optional fee/memo/permission/header.
 * @returns An unsigned {@link SignableTransaction} (`txID` recomputed locally).
 */
export async function buildTransaction(
  client: Client,
  parameters: BuildTransactionParameters,
): Promise<BuildTransactionReturnType> {
  const { contract, feeLimit, data, permissionId, blockHeader } = parameters

  // Bake the permission id into the contract before the id is derived, so the
  // built transaction is bound to that permission (matches signTransaction).
  const boundContract =
    permissionId !== undefined ? { ...contract, permissionId } : contract

  // Wrap the contract in the raw_data model (fee_limit / data only when given).
  let rawData: RawData = { contract: [boundContract] }
  if (feeLimit !== undefined) rawData = { ...rawData, feeLimit }
  if (data !== undefined) rawData = { ...rawData, data }

  // Timing + TaPoS: a complete custom header is used verbatim (no node call);
  // otherwise derive them from the latest block's own timestamp.
  if (blockHeader) {
    rawData = {
      ...rawData,
      refBlockBytes: blockHeader.refBlockBytes,
      refBlockHash: blockHeader.refBlockHash,
      timestamp: blockHeader.timestamp,
      expiration: blockHeader.expiration,
    }
  } else {
    const block = await getAction(
      client,
      getNowBlock,
      'getNowBlock',
    )(undefined as never)
    rawData = fillBlockHeader(rawData, block)
  }

  // A fully built, unsigned transaction — the id is recomputed locally from
  // raw_data (never trusted from a node), matching what signing would derive.
  return {
    txID: getTransactionId(rawData),
    raw_data: rawData,
    raw_data_hex: toRawDataHex(rawData),
  }
}
