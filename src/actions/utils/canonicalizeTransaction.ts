import type { SignableTransaction } from '../../accounts/types.js'
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import {
  type DecodeRawDataErrorType,
  decodeRawData,
} from '../../utils/transaction/decodeRawData.js'
import {
  type TxCheckErrorType,
  txCheck,
} from '../../utils/transaction/txCheck.js'

export type CanonicalizeTransactionErrorType =
  | BaseErrorType
  | DecodeRawDataErrorType
  | TxCheckErrorType
  | ErrorType

/**
 * The gate for every endpoint that relays a caller-supplied transaction to a
 * node (`broadcasttransaction`, `getsignweight`, `getapprovedlist`). Those
 * endpoints rebuild the transaction from the `raw_data` JSON — `raw_data_hex`
 * is ignored server-side — and read it as java-tron's `visible: false`
 * rendering: `41…` hex addresses, nothing else.
 *
 * {@link txCheck} alone is a one-way gate there. It runs the SDK's serializer,
 * which is deliberately lenient on the encode side (Base58 `T…`, `0x` EVM
 * 20-byte and `Uint8Array` addresses, `bigint` amounts), so a model in any of
 * those spellings passes it byte-for-byte — a `visible: true` rendering from a
 * node, TronLink or TronWeb, say — and would then reach the node verbatim, in a
 * form it cannot parse or parses to other bytes. So once the triple has passed,
 * `raw_data` is re-derived from the checked `raw_data_hex`: {@link decodeRawData}
 * yields the `visible: false` rendering by construction, the same encode∘decode
 * canonicalization the build path applies. A carried `visible` flag is pinned
 * to `false` to keep describing the model it rides with.
 *
 * @param snapshot A `cloneTransaction` snapshot — plain data, already detached
 * from the caller's object.
 * @returns The snapshot with `raw_data` in the canonical node-JSON shape.
 */
export function canonicalizeTransaction<
  transaction extends SignableTransaction,
>(snapshot: transaction): transaction {
  if (!txCheck(snapshot))
    throw new BaseError('The transaction failed its integrity check (txCheck).')
  return {
    ...snapshot,
    ...('visible' in snapshot ? { visible: false } : {}),
    raw_data: decodeRawData(snapshot.raw_data_hex),
  }
}
