import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import { type DecodeRawDataErrorType, decodeRawData } from './decodeRawData.js'
import {
  type RawData,
  type SerializeRawDataErrorType,
  serializeRawData,
} from './serializeRawData.js'

/**
 * A `Transaction` in java-tron's HTTP JSON shape (`visible: false`), matching
 * what TronWeb's `transactionBuilder` returns: `txID`, the snake_case
 * {@link RawData}, and `raw_data_hex`, plus `signature` once signed.
 */
export type NodeTransaction = {
  /** Address encoding: `false` = `41…`-hex (this SDK's canonical form). */
  visible: boolean
  /** Transaction id (64 hex chars, no `0x`). */
  txID?: string | undefined
  /** The `raw_data` in the canonical node-JSON shape. */
  raw_data: RawData
  /** Serialized `raw_data` bytes (bare hex). */
  raw_data_hex?: string | undefined
  /** Accumulated signatures (bare lowercase hex); omitted when unsigned. */
  signature?: string[] | undefined
}

/** The transaction shape {@link toNodeTransaction} accepts. */
export type ToNodeTransactionInput = {
  txID?: string | undefined
  raw_data?: RawData | undefined
  raw_data_hex?: string | undefined
  signature?: string[] | undefined
}

export type ToNodeTransactionErrorType =
  | SerializeRawDataErrorType
  | DecodeRawDataErrorType
  | BaseErrorType
  | ErrorType

/**
 * Shapes a built (or signed) transaction as java-tron's HTTP JSON —
 * TronWeb-compatible `{ visible, txID, raw_data, raw_data_hex, signature? }`.
 * The model already IS the node shape; `raw_data` is canonicalized through
 * the encode∘decode roundtrip (idempotent on canonical input) so flexible
 * encode-side values (`bigint`, `0x`-hex, Base58 addresses) never leak into
 * a returned transaction and the result is always `JSON.stringify`-safe.
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
    raw_data: decodeRawData(serializeRawData(raw_data)),
  }
  if (txID !== undefined) result.txID = txID
  if (raw_data_hex !== undefined) result.raw_data_hex = raw_data_hex
  if (signature && signature.length > 0) result.signature = signature
  return result
}
