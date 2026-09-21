import type {
  AccountKey,
  SignableTransaction,
  TronAccount,
} from '../../accounts/types.js'
import {
  type MultiSignTransactionErrorType,
  multiSignTransaction,
} from '../../accounts/utils/multiSignTransaction.js'
import type { Client } from '../../clients/createClient.js'
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import {
  AccountNotFoundError,
  type AccountNotFoundErrorType,
} from '../../errors/rpc.js'
import type { ErrorType } from '../../errors/utils.js'
import {
  type ParseAccountErrorType,
  parseAccount,
} from '../../types/account.js'
import type { Hex } from '../../types/misc.js'

export type MultiSignParameters = {
  /** The transaction to co-sign — fresh or already carrying other signatures. */
  transaction: SignableTransaction
  /**
   * The co-signing account (falls back to `client.account`), as in the sibling
   * sign actions. Its own `multiSign` does the signing, so an HD or custom
   * (key-less) account co-signs without its key ever being extracted.
   */
  account?: TronAccount | AccountKey | undefined
  /**
   * A signer's secp256k1 private key, `0x`-prefixed or bare hex — the raw-key
   * calling convention, equivalent to passing the same string as `account`.
   * Names the signer outright, so it takes precedence over a hoisted
   * `client.account`; passing it together with `account` throws.
   */
  privateKey?: Hex | string | undefined
  /**
   * The active/owner permission id (`Permission.id`) this signature is for.
   * Defaults to the id already baked into the transaction
   * (`contract[0].Permission_id`); absent everywhere means the owner
   * permission (id 0).
   */
  permissionId?: number | undefined
}

export type MultiSignReturnType = SignableTransaction

export type MultiSignErrorType =
  | AccountNotFoundErrorType
  | MultiSignTransactionErrorType
  | ParseAccountErrorType
  | BaseErrorType
  | ErrorType

/**
 * Adds one party's signature to a multi-signature transaction under a
 * permission id and returns the co-signed transaction. Signing is fully
 * local and deterministic — no node is contacted, and the bytes signed are
 * exactly the triple the caller passes in.
 *
 * The signer is resolved like the sibling sign actions: the per-call
 * `account`, else the Client's hoisted one — a thin delegate to that account's
 * own `multiSign`. A raw `privateKey` is accepted as well and goes straight to
 * {@link multiSignTransaction}, the core every key-backed account's
 * `multiSign` runs too, so both conventions produce the same bytes. The
 * guards, the permission-id bind and the signing behavior are documented
 * there.
 *
 * @param client The Client — consulted only for its hoisted account; signing
 * is local.
 * @param parameters Transaction, the signer (`account`, else `client.account`
 * — or a raw `privateKey`), and optionally the permission id (defaults to the
 * baked one).
 * @returns A new {@link SignableTransaction} with this signature appended.
 */
export async function multiSign(
  client: Client,
  parameters: MultiSignParameters,
): Promise<MultiSignReturnType> {
  const { transaction, privateKey, permissionId } = parameters

  if (privateKey !== undefined) {
    // Two named signers: signing with either would silently ignore the other.
    if (parameters.account !== undefined)
      throw new BaseError(
        'multiSign takes either `account` or `privateKey`, not both.',
      )
    return multiSignTransaction({ transaction, privateKey, permissionId })
  }

  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)
  // Optional on a custom account: a caller-supplied signer may not co-sign.
  if (typeof account.multiSign !== 'function')
    throw new BaseError(
      `The account (${account.address}) does not implement \`multiSign\`.`,
    )
  return account.multiSign(transaction, { permissionId })
}
