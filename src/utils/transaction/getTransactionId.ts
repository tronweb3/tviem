import type { ErrorType } from '../../errors/utils.js'
import { type Sha256ErrorType, sha256 } from '../hash/sha256.js'
import {
  type RawData,
  type SerializeRawDataErrorType,
  serializeRawData,
} from './serializeRawData.js'

export type GetTransactionIdErrorType =
  | SerializeRawDataErrorType
  | Sha256ErrorType
  | ErrorType

/**
 * Computes a transaction id: the SHA-256 of the serialized `raw_data`
 * bytes, as lowercase hex (no `0x` prefix). Signatures are not part of the
 * hashed bytes, so adding or removing them does not change the id.
 *
 * @param rawData Raw data model.
 * @returns Transaction id (64 hex chars).
 */
export function getTransactionId(rawData: RawData): string {
  return sha256(serializeRawData(rawData), 'hex').slice(2)
}
