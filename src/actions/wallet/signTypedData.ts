import type {
  AccountKey,
  AccountSignTypedDataParameters,
  TronAccount,
} from '../../accounts/types.js'
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
import type { Signature } from '../../utils/signature/sign.js'
import type { SignTypedDataErrorType as SignTypedDataErrorType_account } from '../../utils/signature/signTypedData.js'

export type SignTypedDataParameters = AccountSignTypedDataParameters & {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | AccountKey | undefined
}
export type SignTypedDataReturnType = Signature

export type SignTypedDataErrorType =
  | AccountNotFoundErrorType
  | ParseAccountErrorType
  | SignTypedDataErrorType_account
  | ErrorType

/**
 * Signs TIP-712 typed structured data with the resolved account (per-call
 * `account`, else the Client's hoisted one) — a thin delegate to the
 * account's own `signTypedData`, so the client surface mirrors viem's
 * `walletClient.signTypedData` while the signing itself stays on the account.
 *
 * @param client The Client to use.
 * @param parameters The TIP-712 `domain` / `types` / `primaryType` /
 * `message`, optional `account`.
 * @returns The TRON-wire {@link Signature}.
 */
export async function signTypedData(
  client: Client,
  parameters: SignTypedDataParameters,
): Promise<SignTypedDataReturnType> {
  const { account: source = client.account, ...rest } = parameters
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)
  return account.signTypedData(rest)
}
