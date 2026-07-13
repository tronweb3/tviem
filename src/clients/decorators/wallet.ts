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
  type CancelAllUnfreezeV2Parameters,
  type CancelAllUnfreezeV2ReturnType,
  cancelAllUnfreezeV2,
} from '../../actions/wallet/cancelAllUnfreezeV2.js'
import {
  type DelegateResourceParameters,
  type DelegateResourceReturnType,
  delegateResource,
} from '../../actions/wallet/delegateResource.js'
import {
  type DeployContractParameters,
  type DeployContractReturnType,
  deployContract,
} from '../../actions/wallet/deployContract.js'
import {
  type FreezeBalanceV2Parameters,
  type FreezeBalanceV2ReturnType,
  freezeBalanceV2,
} from '../../actions/wallet/freezeBalanceV2.js'
import {
  type SendTrc10Parameters,
  type SendTrc10ReturnType,
  sendTrc10,
} from '../../actions/wallet/sendTrc10.js'
import {
  type SendTrxParameters,
  type SendTrxReturnType,
  sendTrx,
} from '../../actions/wallet/sendTrx.js'
import {
  type UndelegateResourceParameters,
  type UndelegateResourceReturnType,
  undelegateResource,
} from '../../actions/wallet/undelegateResource.js'
import {
  type UnfreezeBalanceV2Parameters,
  type UnfreezeBalanceV2ReturnType,
  unfreezeBalanceV2,
} from '../../actions/wallet/unfreezeBalanceV2.js'
import {
  type VoteWitnessParameters,
  type VoteWitnessReturnType,
  voteWitness,
} from '../../actions/wallet/voteWitness.js'
import {
  type WithdrawBalanceParameters,
  type WithdrawBalanceReturnType,
  withdrawBalance,
} from '../../actions/wallet/withdrawBalance.js'
import {
  type WithdrawExpireUnfreezeParameters,
  type WithdrawExpireUnfreezeReturnType,
  withdrawExpireUnfreeze,
} from '../../actions/wallet/withdrawExpireUnfreeze.js'
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
  /** Deploys a smart contract (local build → sign → broadcast). */
  deployContract: (
    parameters: DeployContractParameters,
  ) => Promise<DeployContractReturnType>
  /** Broadcasts a locally-signed transaction. */
  broadcastTransaction: (
    parameters: BroadcastTransactionParameters,
  ) => Promise<BroadcastTransactionReturnType>
  /** Stakes (freezes) TRX for bandwidth or energy (Stake 2.0). */
  freezeBalanceV2: (
    parameters: FreezeBalanceV2Parameters,
  ) => Promise<FreezeBalanceV2ReturnType>
  /** Unstakes (unfreezes) TRX previously frozen under Stake 2.0. */
  unfreezeBalanceV2: (
    parameters: UnfreezeBalanceV2Parameters,
  ) => Promise<UnfreezeBalanceV2ReturnType>
  /** Cancels all pending Stake 2.0 unfreeze requests, re-staking them. */
  cancelAllUnfreezeV2: (
    parameters?: CancelAllUnfreezeV2Parameters,
  ) => Promise<CancelAllUnfreezeV2ReturnType>
  /** Withdraws expired (matured) unfrozen TRX to the owner's balance. */
  withdrawExpireUnfreeze: (
    parameters?: WithdrawExpireUnfreezeParameters,
  ) => Promise<WithdrawExpireUnfreezeReturnType>
  /** Delegates bandwidth or energy resource to another account. */
  delegateResource: (
    parameters: DelegateResourceParameters,
  ) => Promise<DelegateResourceReturnType>
  /** Reclaims resource previously delegated to another account. */
  undelegateResource: (
    parameters: UndelegateResourceParameters,
  ) => Promise<UndelegateResourceReturnType>
  /** Votes for super representatives (witnesses) with TRON Power. */
  voteWitness: (
    parameters: VoteWitnessParameters,
  ) => Promise<VoteWitnessReturnType>
  /** Withdraws accumulated voting/SR rewards to the owner's balance. */
  withdrawBalance: (
    parameters?: WithdrawBalanceParameters,
  ) => Promise<WithdrawBalanceReturnType>
  /** Sends a TRC10 asset to a recipient. */
  sendTrc10: (parameters: SendTrc10Parameters) => Promise<SendTrc10ReturnType>
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
    deployContract: async (parameters) =>
      getAction(
        client,
        deployContract,
        'deployContract',
      )(requireAccount(client, parameters)),
    broadcastTransaction: (parameters) =>
      getAction(
        client,
        broadcastTransaction,
        'broadcastTransaction',
      )(parameters),
    freezeBalanceV2: async (parameters) =>
      getAction(
        client,
        freezeBalanceV2,
        'freezeBalanceV2',
      )(requireAccount(client, parameters)),
    unfreezeBalanceV2: async (parameters) =>
      getAction(
        client,
        unfreezeBalanceV2,
        'unfreezeBalanceV2',
      )(requireAccount(client, parameters)),
    cancelAllUnfreezeV2: async (parameters = {}) =>
      getAction(
        client,
        cancelAllUnfreezeV2,
        'cancelAllUnfreezeV2',
      )(requireAccount(client, parameters)),
    withdrawExpireUnfreeze: async (parameters = {}) =>
      getAction(
        client,
        withdrawExpireUnfreeze,
        'withdrawExpireUnfreeze',
      )(requireAccount(client, parameters)),
    delegateResource: async (parameters) =>
      getAction(
        client,
        delegateResource,
        'delegateResource',
      )(requireAccount(client, parameters)),
    undelegateResource: async (parameters) =>
      getAction(
        client,
        undelegateResource,
        'undelegateResource',
      )(requireAccount(client, parameters)),
    voteWitness: async (parameters) =>
      getAction(
        client,
        voteWitness,
        'voteWitness',
      )(requireAccount(client, parameters)),
    withdrawBalance: async (parameters = {}) =>
      getAction(
        client,
        withdrawBalance,
        'withdrawBalance',
      )(requireAccount(client, parameters)),
    sendTrc10: async (parameters) =>
      getAction(
        client,
        sendTrc10,
        'sendTrc10',
      )(requireAccount(client, parameters)),
  }
}
