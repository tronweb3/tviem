import type { ErrorType } from '../../errors/utils.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import { bytesToHex } from '../encoding/toHex.js'
import { decodeRawData } from './decodeRawData.js'
import { getTransactionId } from './getTransactionId.js'
import { toRawDataHex } from './serializeRawData.js'

/** Normalizes hex/bytes input to bare lowercase hex (no `0x`). */
function bareHex(input: ByteArray | string): string {
  const hex = typeof input === 'string' ? input : bytesToHex(input)
  return (hex.startsWith('0x') ? hex.slice(2) : hex).toLowerCase()
}

export type TxCheckErrorType = ErrorType

/**
 * Verifies a serialized transaction against its id. The `raw_data` is
 * decoded and re-serialized canonically, and its id recomputed; the check
 * passes only when both the re-serialized `raw_data_hex` and the recomputed
 * id match the inputs. Structurally invalid `raw_data` (e.g. truncated or a
 * corrupted length prefix) returns `false` rather than throwing.
 *
 * @param rawDataHex `raw_data` bytes or hex (bare or `0x`-prefixed).
 * @param txId Expected transaction id (bare or `0x`-prefixed hex).
 * @returns `true` when the transaction is self-consistent.
 */
export function txCheck(
  rawDataHex: ByteArray | Hex | string,
  txId: string,
): boolean {
  try {
    const rawData = decodeRawData(rawDataHex)
    return (
      toRawDataHex(rawData) === bareHex(rawDataHex) &&
      getTransactionId(rawData) === bareHex(txId)
    )
  } catch {
    return false
  }
}
