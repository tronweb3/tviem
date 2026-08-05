import type {
  AccountSignMessageParameters,
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
import type { Hex } from '../../types/misc.js'
import type { Signature } from '../../utils/signature/sign.js'
import type { SignMessageErrorType as SignMessageErrorType_account } from '../../utils/signature/signMessage.js'

export type SignMessageParameters = AccountSignMessageParameters & {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
}
export type SignMessageReturnType = Signature

export type SignMessageErrorType =
  | AccountNotFoundErrorType
  | ParseAccountErrorType
  | SignMessageErrorType_account
  | ErrorType

/**
 * Signs a message per TIP-191 with the resolved account (per-call `account`,
 * else the Client's hoisted one) — a thin delegate to the account's own
 * `signMessage`, so the client surface mirrors viem's `walletClient
 * .signMessage` while the signing itself stays on the account.
 *
 * @param client The Client to use.
 * @param parameters `message` (UTF-8 string or `{ raw }`), optional `account`.
 * @returns The TRON-wire {@link Signature}.
 */
export async function signMessage(
  client: Client,
  parameters: SignMessageParameters,
): Promise<SignMessageReturnType> {
  const { account: source = client.account, ...rest } = parameters
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)
  return account.signMessage(rest)
}
