import type { SignableTransaction } from '../../accounts/types.js'
import {
  type SignTransactionErrorType,
  signTransaction,
} from '../../accounts/utils/signTransaction.js'
import type { Client } from '../../clients/createClient.js'
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Hex } from '../../types/misc.js'
import { getTransactionId, toRawDataHex } from '../../utils/index.js'
import { txCheck } from '../../utils/transaction/txCheck.js'

export type MultiSignParameters = {
  /** The transaction to co-sign — fresh or already carrying other signatures. */
  transaction: SignableTransaction
  /** A signer's secp256k1 private key, `0x`-prefixed or bare hex. */
  privateKey: Hex | string
  /**
   * The active/owner permission id (`Permission.id`) this signature is for.
   * Defaults to the id already baked into the transaction
   * (`contract[0].Permission_id`); absent everywhere means the owner
   * permission (id 0).
   */
  permissionId?: number
}

export type MultiSignReturnType = SignableTransaction

export type MultiSignErrorType =
  | SignTransactionErrorType
  | BaseErrorType
  | ErrorType

/**
 * Adds one party's signature to a multi-signature transaction under a
 * permission id and returns the co-signed transaction. Signing is **fully
 * local and deterministic** — no node is contacted, so co-signing runs
 * air-gapped, and the bytes signed are exactly the triple the caller passes in.
 *
 * The multi-sig guards AND the bind live here; the transaction must arrive
 * as a self-consistent `txID` + `raw_data` + `raw_data_hex` triple (it is
 * gated by `txCheck`, like every signing path):
 * - `permissionId` must be a non-negative integer when given; when omitted
 *   it adopts the id already baked into `contract[0]` (absent = the owner
 *   permission, id 0);
 * - a transaction already bound to a **different** permission id throws — a
 *   re-bind would change the txID and orphan every collected signature; an
 *   equal, already-baked id is idempotent;
 * - binding a fresh positive id onto a transaction that already carries
 *   signatures throws (they would go stale; id 0 encodes to nothing, so an
 *   owner-permission co-sign of signed bytes stays allowed).
 *
 * A fresh bind changes the serialized bytes, so `txID` and `raw_data_hex`
 * are recomputed locally from the bound model (a node-supplied id is never
 * trusted; the recompute is a no-op when nothing was bound) before
 * delegating to {@link signTransaction}, which re-verifies the triple and
 * signs. Its owner guard is satisfied by passing the transaction's own
 * `owner_address` as the expected address — that is what lets a non-owner
 * co-signer sign here — and this key's signature is de-duplicated
 * (hex-case-insensitively).
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
 * @param parameters Transaction, a signer's private key, and optionally the
 * permission id (defaults to the baked one).
 * @returns A new {@link SignableTransaction} with this signature appended.
 */
export async function multiSign(
  _client: Client,
  parameters: MultiSignParameters,
): Promise<MultiSignReturnType> {
  const { transaction, privateKey } = parameters

  if (!txCheck(transaction))
    throw new BaseError('The transaction failed its integrity check (txCheck).')

  const { raw_data } = transaction

  const permissionId =
    parameters.permissionId ?? raw_data.contract[0]?.Permission_id

  if (
    permissionId !== undefined &&
    (!Number.isInteger(permissionId) || permissionId < 0)
  )
    throw new BaseError(
      `Invalid multi-sig permission id: ${permissionId}. Expected a non-negative integer (an active permission's id is >= 2).`,
    )

  // A transaction already bound to a different id is never re-bound — that
  // would change the txID and orphan every collected signature.
  for (const contract of raw_data.contract)
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
    permissionId !== undefined &&
    permissionId > 0 &&
    raw_data.contract.some((contract) => contract.Permission_id === undefined)

  if (binds && transaction.signature?.length)
    throw new BaseError(
      `Cannot bind permission id ${permissionId}: the transaction already carries ${transaction.signature.length} signature(s) over the unbound bytes; binding now would invalidate them.`,
    )

  // All guards passed — write the permission id into every contract. A fresh
  // bind changes the bytes, so txID and raw_data_hex are recomputed from the
  // bound model below (a no-op recompute when nothing was bound).
  const bound = binds
    ? {
        ...raw_data,
        contract: raw_data.contract.map((contract) => ({
          ...contract,
          Permission_id: permissionId,
        })),
      }
    : raw_data

  return signTransaction({
    transaction: {
      ...transaction,
      txID: getTransactionId(bound),
      raw_data: bound,
      raw_data_hex: toRawDataHex(bound),
    },
    privateKey,
    address: (raw_data.contract[0]?.parameter.value as any).owner_address,
  })
}
