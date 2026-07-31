import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import { bareHex } from '../encoding/bareHex.js'
import { type DecodeRawDataErrorType, decodeRawData } from './decodeRawData.js'
import {
  type RawData,
  type SerializeRawDataErrorType,
  serializeRawData,
} from './serializeRawData.js'

/**
 * There is exactly ONE `raw_data` dialect: java-tron's HTTP JSON
 * (`visible: false`) shape — snake_case proto field names, string contract
 * `type`, `41…`/bare-hex byte fields (see {@link RawData}). What this SDK
 * builds, what a node returns, and what TronWeb hands around are the same
 * shape, so no detection or structural conversion exists. These helpers
 * resolve a transaction's `raw_data` to its canonical form and verify a
 * supplied JSON against the authoritative `raw_data_hex` bytes.
 */

export type ResolveRawDataErrorType =
  | SerializeRawDataErrorType
  | DecodeRawDataErrorType
  | BaseErrorType
  | ErrorType

/**
 * Resolves a signable transaction's `raw_data` to the canonical model:
 *
 * - When both `raw_data` and `raw_data_hex` are present, the JSON is
 *   verified against the bytes: it is strictly re-serialized (unknown keys
 *   throw — see `serializeRawData`) and must reproduce `raw_data_hex`
 *   exactly, else this throws. The bytes are what gets signed; a
 *   human-readable form that disagrees with them is refused. Flexible
 *   encode-side inputs (Base58 addresses, `bigint`/string int64, `0x` hex)
 *   are absorbed by the serialization, so any faithful rendering of the
 *   same bytes passes.
 * - A `raw_data` alone is canonicalized via the encode∘decode roundtrip.
 * - A `raw_data_hex` alone is decoded.
 *
 * @returns The canonical model, or `undefined` when the transaction carries
 * neither representation.
 */
export function resolveRawData(transaction: {
  raw_data?: RawData | undefined
  raw_data_hex?: string | undefined
}): RawData | undefined {
  const { raw_data, raw_data_hex } = transaction
  if (raw_data) {
    const bytes = serializeRawData(raw_data)
    if (raw_data_hex !== undefined) {
      if (bareHex(bytes) !== bareHex(raw_data_hex))
        throw new BaseError(
          'The supplied `raw_data` JSON does not serialize to the `raw_data_hex` bytes. The bytes are what gets signed — refusing to sign a transaction whose human-readable form disagrees with them.',
        )
    }
    return decodeRawData(bytes)
  }
  return raw_data_hex ? decodeRawData(raw_data_hex) : undefined
}

/**
 * The `raw_data` for an outgoing JSON body (`getsignweight` /
 * `getapprovedlist` — endpoints that rebuild the transaction from `raw_data`
 * JSON): the transaction's own `raw_data` (already the node shape), else the
 * decoded `raw_data_hex`.
 */
export function nodeRawDataOf(transaction: {
  raw_data?: RawData | undefined
  raw_data_hex?: string | undefined
}): RawData | undefined {
  if (transaction.raw_data) return transaction.raw_data
  return transaction.raw_data_hex
    ? decodeRawData(transaction.raw_data_hex)
    : undefined
}
