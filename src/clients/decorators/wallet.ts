// Structure vendored (de-branded) and adapted for TRON: the action set is
// TRON's write pipeline (local build → sign → broadcast). Each account-taking
// action resolves `args.account ?? client.account` and throws
// `AccountNotFoundError` when neither is present; every action is bound through
// `getAction` so a consumer can override any of them on the Client.

import type { TronAccount } from '../../accounts/types.js'
import {
  type BroadcastTransactionParameters,
  type BroadcastTransactionReturnType,
  broadcastTransaction,
} from '../../actions/wallet/broadcastTransaction.js'
import {
  type SendTrxParameters,
  type SendTrxReturnType,
  sendTrx,
} from '../../actions/wallet/sendTrx.js'
import {
  type WriteContractParameters,
  type WriteContractReturnType,
  writeContract,
} from '../../actions/wallet/writeContract.js'
import { AccountNotFoundError } from '../../errors/rpc.js'
import type { Hex } from '../../types/misc.js'
import { getAction } from '../../utils/getAction.js'
import type { Client } from '../createClient.js'

export type WalletActions = {
  /** Sends TRX to a recipient. */
  sendTrx: (parameters: SendTrxParameters) => Promise<SendTrxReturnType>
  /** Writes to (state-changing calls) a contract function. */
  writeContract: (
    parameters: WriteContractParameters,
  ) => Promise<WriteContractReturnType>
  /** Broadcasts a locally-signed transaction. */
  broadcastTransaction: (
    parameters: BroadcastTransactionParameters,
  ) => Promise<BroadcastTransactionReturnType>
}

/**
 * Resolves the account for an account-taking write action: `args.account`
 * falls back to `client.account`. Throws {@link AccountNotFoundError} when
 * neither is present, and returns `args` with the resolved `account` injected.
 */
function requireAccount<
  parameters extends { account?: TronAccount | Hex | undefined },
>(
  client: Client,
  parameters: parameters,
): parameters & { account: TronAccount | Hex } {
  const account = parameters.account ?? client.account
  if (!account) throw new AccountNotFoundError()
  return { ...parameters, account }
}

/**
 * The TRON write (wallet) action set. `sendTrx` / `writeContract` require an
 * account (per-call or hoisted on the Client); `broadcastTransaction` takes an
 * already-signed transaction and needs none.
 */
export function walletActions(client: Client): WalletActions {
  return {
    // `async` so a synchronous `requireAccount` throw surfaces as a rejected
    // promise, keeping the action's contract uniformly promise-based.
    sendTrx: async (parameters) =>
      getAction(client, sendTrx, 'sendTrx')(requireAccount(client, parameters)),
    writeContract: async (parameters) =>
      getAction(
        client,
        writeContract,
        'writeContract',
      )(requireAccount(client, parameters)),
    broadcastTransaction: (parameters) =>
      getAction(
        client,
        broadcastTransaction,
        'broadcastTransaction',
      )(parameters),
  }
}
