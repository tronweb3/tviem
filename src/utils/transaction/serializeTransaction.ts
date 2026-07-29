// TRON-specific, clean-room implementation for @tronweb3/tviem.
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import { concatBytes } from '../data/concat.js'
import { type HexToBytesErrorType, hexToBytes } from '../encoding/toBytes.js'
import { type BytesToHexErrorType, bytesToHex } from '../encoding/toHex.js'
import { isNodeRawData } from './nodeRawData.js'
import {
  type FBytesErrorType,
  type FMessageErrorType,
  fBytes,
  fMessage,
} from './protobuf/writer.js'
import {
  type RawData,
  type SerializeRawDataErrorType,
  serializeRawData,
} from './serializeRawData.js'
import type { NodeRawData } from './toNodeRawData.js'

/** A signed transaction reduced to the fields the wire form needs. */
export type SerializableTransaction = {
  /** The `Transaction.raw_data` (either dialect; used when `raw_data_hex` is absent). */
  raw_data?: RawData | NodeRawData | undefined
  /** Serialized `raw_data` bytes (bare hex) — preferred when present. */
  raw_data_hex?: string | undefined
  /** Accumulated signatures (TRON wire form, bare lowercase hex). */
  signature?: string[] | undefined
}

export type SerializeTransactionErrorType =
  | SerializeRawDataErrorType
  | HexToBytesErrorType
  | BytesToHexErrorType
  | FMessageErrorType
  | FBytesErrorType
  | BaseErrorType
  | ErrorType

function bareHexToBytes(hex: string): ByteArray {
  return hexToBytes(`0x${hex.replace(/^0x/, '')}` as Hex)
}

/**
 * Serializes a signed transaction to the full `protocol.Transaction` protobuf
 * bytes: `raw_data` (field 1, embedded message) followed by each `signature`
 * (field 2, repeated `bytes`). `ret` (field 5) is omitted — it is not part of
 * the signed pre-image.
 *
 * The `raw_data` bytes come from `raw_data_hex` when present (the canonical
 * signed bytes), otherwise from encoding the `raw_data` model. Signature order
 * is preserved (it is load-bearing for multi-sig).
 *
 * @param transaction A signed transaction.
 * @returns The full `Transaction` protobuf bytes.
 */
export function serializeTransaction(
  transaction: SerializableTransaction,
): ByteArray {
  const { raw_data, raw_data_hex, signature } = transaction
  const rawDataBytes =
    raw_data_hex !== undefined
      ? bareHexToBytes(raw_data_hex)
      : raw_data !== undefined && !isNodeRawData(raw_data)
        ? serializeRawData(raw_data)
        : (() => {
            throw new BaseError(
              raw_data !== undefined
                ? 'Cannot serialize a node-JSON `raw_data` without its `raw_data_hex` (the authoritative bytes).'
                : 'Cannot serialize a transaction without `raw_data` or `raw_data_hex`.',
            )
          })()

  // field 1 (raw_data) is always present, even when empty; each signature is a
  // repeated field-2 bytes entry in order.
  const parts: ByteArray[] = [fMessage(1, rawDataBytes, { emitDefault: true })]
  for (const sig of signature ?? []) parts.push(fBytes(2, bareHexToBytes(sig)))
  return concatBytes(parts)
}

/**
 * The `/wallet/broadcasthex` payload: {@link serializeTransaction} as bare
 * lowercase hex (no `0x` prefix). The node broadcasts these exact bytes without
 * re-parsing any JSON, so the relayed transaction is byte-identical to what was
 * signed.
 *
 * @param transaction A signed transaction.
 * @returns Bare lowercase hex of the full `Transaction` protobuf.
 */
export function toBroadcastHex(transaction: SerializableTransaction): string {
  return bytesToHex(serializeTransaction(transaction)).slice(2)
}
