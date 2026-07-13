// TRON-specific, clean-room implementation for @tronweb3/omni.
import { BaseError } from '../../errors/base.js'
import type { Hex } from '../../types/misc.js'
import type { SignableTransaction } from '../types.js'
import {
  type SignTransactionErrorType,
  signTransaction,
} from './signTransaction.js'

export type MultiSignParameters = {
  /** The transaction to co-sign — fresh or already carrying other signatures. */
  transaction: SignableTransaction
  /** A signer's secp256k1 private key, `0x`-prefixed or bare hex. */
  privateKey: Hex | string
  /** The active/owner permission id (`Permission.id`) this signature is for. */
  permissionId: number
}

export type MultiSignErrorType = SignTransactionErrorType

/**
 * Adds one party's signature to a multi-signature transaction under a
 * permission id, and returns the transaction with the signature appended — the
 * input is never mutated, so the partially-signed transaction can be threaded
 * from one signer to the next until the permission's weight threshold is met.
 *
 * This is entirely local and never contacts a node: it delegates to
 * {@link signTransaction}, which writes `permissionId` into every contract,
 * **recomputes the txID locally** from `raw_data` (a node-supplied id is never
 * trusted), skips the owner-address guard so a non-owner co-signer can sign,
 * and de-duplicates a key's signature. Because it signs only bytes it
 * serialized itself, the transaction the network's `getSignWeight` endpoint
 * echoes back can never substitute what gets signed — unlike TronWeb's
 * `multiSign`, which adopts and signs the node-returned transaction.
 *
 * Because the permission id must be injected before the id is derived, this
 * takes a raw `privateKey`: a `TronAccount`'s bound signer intentionally does
 * not forward a `permissionId`. Query accumulated weight and the approved list
 * with `getSignWeight` / `getApprovedList` (both re-verify the node's echoed
 * transaction against the local one).
 *
 * @param parameters Transaction, a signer's private key, the permission id.
 * @returns A new {@link SignableTransaction} with this signature appended.
 */
export function multiSign(
  parameters: MultiSignParameters,
): SignableTransaction {
  const { transaction, privateKey, permissionId } = parameters

  if (!Number.isInteger(permissionId) || permissionId < 0)
    throw new BaseError(
      `Invalid multi-sig permission id: ${permissionId}. Expected a non-negative integer (an active permission's id is >= 2).`,
    )

  return signTransaction({ transaction, privateKey, permissionId })
}
