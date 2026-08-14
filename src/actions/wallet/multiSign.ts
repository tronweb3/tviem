import type { SignableTransaction } from '../../accounts/types.js'
import {
  type MultiSignTransactionErrorType,
  multiSignTransaction,
} from '../../accounts/utils/multiSignTransaction.js'
import type { Client } from '../../clients/createClient.js'
import type { BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Hex } from '../../types/misc.js'

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
  | MultiSignTransactionErrorType
  | BaseErrorType
  | ErrorType

/**
 * Adds one party's signature to a multi-signature transaction under a
 * permission id and returns the co-signed transaction. Signing is fully
 * local and deterministic — no node is contacted, and the bytes signed are
 * exactly the triple the caller passes in.
 *
 * A thin delegate to {@link multiSignTransaction} — the guards, the
 * permission-id bind and the signing behavior are documented there. The same
 * core backs an account's `multiSign` method; this action is the
 * private-key calling convention.
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
  return multiSignTransaction(parameters)
}
