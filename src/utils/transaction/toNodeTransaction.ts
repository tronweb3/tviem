// TRON-specific, clean-room implementation for @tronweb3/tviem.
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import { isNodeRawData } from './nodeRawData.js'
import type { RawData } from './serializeRawData.js'
import {
  type NodeRawData,
  type ToNodeRawDataErrorType,
  toNodeRawData,
} from './toNodeRawData.js'

/**
 * A `Transaction` in java-tron's HTTP JSON shape (`visible: false`), matching
 * what TronWeb's `transactionBuilder` returns: `txID`, the snake_case
 * {@link NodeRawData}, and `raw_data_hex`, plus `signature` once signed.
 */
export type NodeTransaction = {
  /** Address encoding: `false` = `41…`-hex (this SDK's canonical form). */
  visible: boolean
  /** Transaction id (64 hex chars, no `0x`). */
  txID?: string | undefined
  /** The `raw_data` in node-JSON shape. */
  raw_data: NodeRawData
  /** Serialized `raw_data` bytes (bare hex). */
  raw_data_hex?: string | undefined
  /** Accumulated signatures (bare lowercase hex); omitted when unsigned. */
  signature?: string[] | undefined
}

/** The transaction shape {@link toNodeTransaction} accepts. */
export type ToNodeTransactionInput = {
  txID?: string | undefined
  raw_data?: RawData | NodeRawData | undefined
  raw_data_hex?: string | undefined
  signature?: string[] | undefined
}

export type ToNodeTransactionErrorType =
  | ToNodeRawDataErrorType
  | BaseErrorType
  | ErrorType

/**
 * Converts a built (or signed) transaction to java-tron's HTTP JSON shape —
 * TronWeb-compatible `{ visible, txID, raw_data, raw_data_hex, signature? }`.
 * `raw_data` is converted via {@link toNodeRawData} (byte-faithful: a node
 * re-serializing it reproduces the same `raw_data_hex` and `txID`).
 * `signature` is included only when non-empty (an unsigned build omits it).
 *
 * @param transaction A transaction carrying a `raw_data` model.
 * @returns The node-JSON transaction (`visible: false`).
 */
export function toNodeTransaction(
  transaction: ToNodeTransactionInput,
): NodeTransaction {
  const { txID, raw_data, raw_data_hex, signature } = transaction
  if (!raw_data)
    throw new BaseError(
      'toNodeTransaction requires a `raw_data` model to convert.',
    )

  const result: NodeTransaction = {
    visible: false,
    // An already node-shaped raw_data passes through untouched.
    raw_data: isNodeRawData(raw_data) ? raw_data : toNodeRawData(raw_data),
  }
  if (txID !== undefined) result.txID = txID
  if (raw_data_hex !== undefined) result.raw_data_hex = raw_data_hex
  if (signature && signature.length > 0) result.signature = signature
  return result
}
