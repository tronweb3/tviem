import type { SignableTransaction } from '../../accounts/types.js'
import {
  type SignTransactionErrorType,
  signTransaction,
} from '../../accounts/utils/signTransaction.js'
import type { Client } from '../../clients/createClient.js'
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Hex } from '../../types/misc.js'
import {
  type ResolveRawDataErrorType,
  resolveRawData,
} from '../../utils/transaction/nodeRawData.js'

export type MultiSignParameters = {
  /** The transaction to co-sign — fresh or already carrying other signatures. */
  transaction: SignableTransaction
  /** A signer's secp256k1 private key, `0x`-prefixed or bare hex. */
  privateKey: Hex | string
  /** The active/owner permission id (`Permission.id`) this signature is for. */
  permissionId: number
}

export type MultiSignReturnType = SignableTransaction

export type MultiSignErrorType =
  | SignTransactionErrorType
  | ResolveRawDataErrorType
  | BaseErrorType
  | ErrorType

/**
 * Adds one party's signature to a multi-signature transaction under a
 * permission id and returns the co-signed transaction. Signing is **fully
 * local and deterministic** — no node is contacted, so co-signing works
 * air-gapped and can never be influenced by a node (the flaw in TronWeb's
 * `multiSign`, which adopts and signs the transaction the node hands back).
 *
 * The multi-sig guards live here (the underlying `signTransaction` writes a
 * given `permissionId` unconditionally — the low-level escape hatch):
 * - `permissionId` must be a non-negative integer, and the transaction must
 *   carry a `raw_data` (or `raw_data_hex`) to bind it into;
 * - a transaction already bound to a **different** permission id throws — a
 *   re-bind would change the txID and orphan every collected signature; an
 *   equal, already-baked id is idempotent;
 * - binding a fresh positive id onto a transaction that already carries
 *   signatures throws (they would go stale; id 0 encodes to nothing, so an
 *   owner-permission co-sign of signed bytes stays allowed).
 *
 * Signing itself is delegated to {@link signTransaction}: the txID is always
 * recomputed locally from `raw_data` (a node-supplied id is never trusted),
 * the owner-address guard is skipped so a non-owner co-signer can sign, and
 * this key's signature is de-duplicated (hex-case-insensitively).
 *
 * The canonical flow bakes the permission id at build time (`buildX(...,
 * { permissionId })`), so every signer — first or later — signs offline with
 * the id already in the bytes. Membership/progress checks (is the signer in
 * the permission's keys, who has signed, is the threshold met) are the node's
 * business at broadcast; to check early, call `getSignWeight` /
 * `getApprovedList` explicitly.
 *
 * @param _client The Client (unused — signing is local; kept for the action
 * calling convention).
 * @param parameters Transaction, a signer's private key, the permission id.
 * @returns A new {@link SignableTransaction} with this signature appended.
 */
export async function multiSign(
  _client: Client,
  parameters: MultiSignParameters,
): Promise<MultiSignReturnType> {
  const { transaction, privateKey, permissionId } = parameters

  if (!Number.isInteger(permissionId) || permissionId < 0)
    throw new BaseError(
      `Invalid multi-sig permission id: ${permissionId}. Expected a non-negative integer (an active permission's id is >= 2).`,
    )

  // Resolves either dialect (SDK model or node JSON) to the model; a node
  // JSON is verified against its raw_data_hex bytes.
  const rawData = resolveRawData(transaction)
  if (!rawData)
    throw new BaseError(
      'Cannot bind a permission id: the transaction carries no `raw_data` (or `raw_data_hex`) to write it into.',
    )

  // A transaction already bound to a different id is never re-bound — that
  // would change the txID and orphan every collected signature.
  for (const contract of rawData.contract)
    if (
      contract.Permission_id !== undefined &&
      contract.Permission_id !== permissionId
    )
      throw new BaseError(
        `Permission id mismatch: the transaction is bound to permission ${contract.Permission_id}, but ${permissionId} was supplied.`,
      )

  // A fresh positive bind changes the serialized bytes (id 0 encodes to
  // nothing), so signatures collected over the unbound bytes would go stale.
  const binds =
    permissionId > 0 &&
    rawData.contract.some((contract) => contract.Permission_id === undefined)
  if (binds && transaction.signature?.length)
    throw new BaseError(
      `Cannot bind permission id ${permissionId}: the transaction already carries ${transaction.signature.length} signature(s) over the unbound bytes; binding now would invalidate them.`,
    )

  return signTransaction({ transaction, privateKey, permissionId })
}
