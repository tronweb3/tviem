import type { SignableTransaction } from '../../accounts/types.js'
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import { bareHex } from '../encoding/bareHex.js'
import { getTransactionId } from './getTransactionId.js'
import { type RawData, toRawDataHex } from './serializeRawData.js'

export type TxCheckErrorType = BaseErrorType | ErrorType

/**
 * Verifies a signable transaction's `raw_data`, `raw_data_hex` and `txID`
 * are mutually consistent: the `raw_data` model must serialize to exactly
 * the `raw_data_hex` bytes, and the id derived from that content must equal
 * `txID`. All three fields are required — a transaction missing any of them
 * is not verifiably consistent and fails the check. Structurally invalid
 * `raw_data` (e.g. an unknown key or a malformed model) returns `false`
 * rather than throwing, as does a `raw_data` that serializes to zero bytes
 * (a contract-less shell is not a transaction). The one exception is API
 * misuse: a non-object argument (e.g. a legacy `(rawDataHex, txId)` call)
 * throws immediately.
 *
 * The bytes are what a signature covers, so the bytes are authoritative:
 * model content the serializer never encodes (proto3-default field values
 * like `Permission_id: 0`) does not affect the verdict.
 *
 * @param transaction The transaction to verify (a `SignableTransaction`);
 * hex fields accept bare or `0x`-prefixed hex (lowercase prefix), with hex
 * digits in either case.
 * @returns `true` when the transaction is self-consistent — doubling as a
 * type guard that narrows the argument to {@link SignableTransaction}.
 */
export function txCheck(transaction: {
  txID?: string | undefined
  raw_data?: RawData | undefined
  raw_data_hex?: string | undefined
}): transaction is SignableTransaction {
  if (typeof transaction !== 'object' || transaction === null)
    throw new BaseError(
      `txCheck expects a signable transaction object (\`{ txID, raw_data, raw_data_hex }\`), got ${
        transaction === null ? 'null' : typeof transaction
      }.`,
    )
  const { txID, raw_data, raw_data_hex } = transaction
  if (!txID || !raw_data || !raw_data_hex) return false
  // A contract-less shell is not a transaction (see above). The zero-bytes
  // check below misses `contract: []` when other fields (e.g. ref-block) still
  // serialize to non-empty bytes; reject it here so downstream owner_address
  // reads never hit an empty contract list.
  if (!Array.isArray(raw_data.contract) || raw_data.contract.length === 0)
    return false
  try {
    const hex = toRawDataHex(raw_data)
    if (hex === '') return false
    return (
      hex === bareHex(raw_data_hex) &&
      getTransactionId(raw_data) === bareHex(txID)
    )
  } catch {
    return false
  }
}
