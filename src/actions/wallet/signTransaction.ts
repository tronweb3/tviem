import type { SignableTransaction, TronAccount } from '../../accounts/types.js'
import type { SignTransactionErrorType as SignTransactionErrorType_account } from '../../accounts/utils/signTransaction.js'
import type { Client } from '../../clients/createClient.js'
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

export type SignTransactionParameters = {
  /**
   * The transaction to sign — the full verified `txID` + `raw_data` +
   * `raw_data_hex` triple (what every `buildX` action returns).
   */
  transaction: SignableTransaction
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
}
export type SignTransactionReturnType = SignableTransaction

export type SignTransactionErrorType =
  | AccountNotFoundErrorType
  | ParseAccountErrorType
  | SignTransactionErrorType_account
  | ErrorType

/**
 * Signs a transaction with the resolved account (per-call `account`, else the
 * Client's hoisted one) — a thin delegate to the account's own
 * `signTransaction`, which recomputes the `txID` and runs the sign guards
 * (integrity triple, owner check, signature de-dup). The input is never
 * mutated; the returned transaction carries the appended signature.
 *
 * Mirrors viem's `walletClient.signTransaction`; non-owner co-signing still
 * goes through the `multiSign` action.
 *
 * @param client The Client to use.
 * @param parameters `transaction` (the built triple), optional `account`.
 * @returns A new {@link SignableTransaction} with this signature appended.
 */
export async function signTransaction(
  client: Client,
  parameters: SignTransactionParameters,
): Promise<SignTransactionReturnType> {
  const { transaction, account: source = client.account } = parameters
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)
  return account.signTransaction(transaction)
}
