import type { Abi } from 'abitype'
import type { TronAccount } from '../../accounts/types.js'
import {
  type AccountPermissionUpdateParameters,
  type AccountPermissionUpdateReturnType,
  accountPermissionUpdate,
  type BuildAccountPermissionUpdateParameters,
  type BuildAccountPermissionUpdateReturnType,
  buildAccountPermissionUpdate,
} from '../../actions/wallet/accountPermissionUpdate.js'
import {
  type ApplyForSrParameters,
  type ApplyForSrReturnType,
  applyForSr,
  type BuildApplyForSrParameters,
  type BuildApplyForSrReturnType,
  buildApplyForSr,
} from '../../actions/wallet/applyForSr.js'
import {
  type BroadcastTransactionParameters,
  type BroadcastTransactionReturnType,
  broadcastTransaction,
} from '../../actions/wallet/broadcastTransaction.js'
import {
  type BuildCancelAllUnfreezeV2Parameters,
  type BuildCancelAllUnfreezeV2ReturnType,
  buildCancelAllUnfreezeV2,
  type CancelAllUnfreezeV2Parameters,
  type CancelAllUnfreezeV2ReturnType,
  cancelAllUnfreezeV2,
} from '../../actions/wallet/cancelAllUnfreezeV2.js'
import {
  type BuildClearAbiParameters,
  type BuildClearAbiReturnType,
  buildClearAbi,
  type ClearAbiParameters,
  type ClearAbiReturnType,
  clearAbi,
} from '../../actions/wallet/clearAbi.js'
import {
  type BuildCreateAccountParameters,
  type BuildCreateAccountReturnType,
  buildCreateAccount,
  type CreateAccountParameters,
  type CreateAccountReturnType,
  createAccount,
} from '../../actions/wallet/createAccount.js'
import {
  type BuildCreateProposalParameters,
  type BuildCreateProposalReturnType,
  buildCreateProposal,
  type CreateProposalParameters,
  type CreateProposalReturnType,
  createProposal,
} from '../../actions/wallet/createProposal.js'
import {
  type BuildCreateTokenParameters,
  type BuildCreateTokenReturnType,
  buildCreateToken,
  type CreateTokenParameters,
  type CreateTokenReturnType,
  createToken,
} from '../../actions/wallet/createToken.js'
import {
  type BuildDelegateResourceParameters,
  type BuildDelegateResourceReturnType,
  buildDelegateResource,
  type DelegateResourceParameters,
  type DelegateResourceReturnType,
  delegateResource,
} from '../../actions/wallet/delegateResource.js'
import {
  type BuildDeleteProposalParameters,
  type BuildDeleteProposalReturnType,
  buildDeleteProposal,
  type DeleteProposalParameters,
  type DeleteProposalReturnType,
  deleteProposal,
} from '../../actions/wallet/deleteProposal.js'
import {
  type BuildDeployContractParameters,
  type BuildDeployContractReturnType,
  buildDeployContract,
  type DeployContractParameters,
  type DeployContractReturnType,
  deployContract,
} from '../../actions/wallet/deployContract.js'
import {
  type BuildExchangeCreateParameters,
  type BuildExchangeCreateReturnType,
  buildExchangeCreate,
  type ExchangeCreateParameters,
  type ExchangeCreateReturnType,
  exchangeCreate,
} from '../../actions/wallet/exchangeCreate.js'
import {
  type BuildExchangeInjectParameters,
  type BuildExchangeInjectReturnType,
  buildExchangeInject,
  type ExchangeInjectParameters,
  type ExchangeInjectReturnType,
  exchangeInject,
} from '../../actions/wallet/exchangeInject.js'
import {
  type BuildExchangeTransactionParameters,
  type BuildExchangeTransactionReturnType,
  buildExchangeTransaction,
  type ExchangeTransactionParameters,
  type ExchangeTransactionReturnType,
  exchangeTransaction,
} from '../../actions/wallet/exchangeTransaction.js'
import {
  type BuildExchangeWithdrawParameters,
  type BuildExchangeWithdrawReturnType,
  buildExchangeWithdraw,
  type ExchangeWithdrawParameters,
  type ExchangeWithdrawReturnType,
  exchangeWithdraw,
} from '../../actions/wallet/exchangeWithdraw.js'
import {
  type BuildFreezeBalanceParameters,
  type BuildFreezeBalanceReturnType,
  buildFreezeBalance,
  type FreezeBalanceParameters,
  type FreezeBalanceReturnType,
  freezeBalance,
} from '../../actions/wallet/freezeBalance.js'
import {
  type BuildFreezeBalanceV2Parameters,
  type BuildFreezeBalanceV2ReturnType,
  buildFreezeBalanceV2,
  type FreezeBalanceV2Parameters,
  type FreezeBalanceV2ReturnType,
  freezeBalanceV2,
} from '../../actions/wallet/freezeBalanceV2.js'
import {
  type MultiSignParameters,
  type MultiSignReturnType,
  multiSign,
} from '../../actions/wallet/multiSign.js'
import {
  type BuildPurchaseTokenParameters,
  type BuildPurchaseTokenReturnType,
  buildPurchaseToken,
  type PurchaseTokenParameters,
  type PurchaseTokenReturnType,
  purchaseToken,
} from '../../actions/wallet/purchaseToken.js'
import {
  type BuildSendTrc10Parameters,
  type BuildSendTrc10ReturnType,
  buildSendTrc10,
  type SendTrc10Parameters,
  type SendTrc10ReturnType,
  sendTrc10,
} from '../../actions/wallet/sendTrc10.js'
import {
  type BuildSendTrxParameters,
  type BuildSendTrxReturnType,
  buildSendTrx,
  type SendTrxParameters,
  type SendTrxReturnType,
  sendTrx,
} from '../../actions/wallet/sendTrx.js'
import {
  type BuildSetAccountIdParameters,
  type BuildSetAccountIdReturnType,
  buildSetAccountId,
  type SetAccountIdParameters,
  type SetAccountIdReturnType,
  setAccountId,
} from '../../actions/wallet/setAccountId.js'
import {
  type SignMessageParameters,
  type SignMessageReturnType,
  signMessage,
} from '../../actions/wallet/signMessage.js'
import {
  type SignTransactionParameters,
  type SignTransactionReturnType,
  signTransaction,
} from '../../actions/wallet/signTransaction.js'
import {
  type SignTypedDataParameters,
  type SignTypedDataReturnType,
  signTypedData,
} from '../../actions/wallet/signTypedData.js'
import {
  type BuildUndelegateResourceParameters,
  type BuildUndelegateResourceReturnType,
  buildUndelegateResource,
  type UndelegateResourceParameters,
  type UndelegateResourceReturnType,
  undelegateResource,
} from '../../actions/wallet/undelegateResource.js'
import {
  type BuildUnfreezeBalanceParameters,
  type BuildUnfreezeBalanceReturnType,
  buildUnfreezeBalance,
  type UnfreezeBalanceParameters,
  type UnfreezeBalanceReturnType,
  unfreezeBalance,
} from '../../actions/wallet/unfreezeBalance.js'
import {
  type BuildUnfreezeBalanceV2Parameters,
  type BuildUnfreezeBalanceV2ReturnType,
  buildUnfreezeBalanceV2,
  type UnfreezeBalanceV2Parameters,
  type UnfreezeBalanceV2ReturnType,
  unfreezeBalanceV2,
} from '../../actions/wallet/unfreezeBalanceV2.js'
import {
  type BuildUpdateAccountParameters,
  type BuildUpdateAccountReturnType,
  buildUpdateAccount,
  type UpdateAccountParameters,
  type UpdateAccountReturnType,
  updateAccount,
} from '../../actions/wallet/updateAccount.js'
import {
  type BuildUpdateBrokerageParameters,
  type BuildUpdateBrokerageReturnType,
  buildUpdateBrokerage,
  type UpdateBrokerageParameters,
  type UpdateBrokerageReturnType,
  updateBrokerage,
} from '../../actions/wallet/updateBrokerage.js'
import {
  type BuildUpdateEnergyLimitParameters,
  type BuildUpdateEnergyLimitReturnType,
  buildUpdateEnergyLimit,
  type UpdateEnergyLimitParameters,
  type UpdateEnergyLimitReturnType,
  updateEnergyLimit,
} from '../../actions/wallet/updateEnergyLimit.js'
import {
  type BuildUpdateSettingParameters,
  type BuildUpdateSettingReturnType,
  buildUpdateSetting,
  type UpdateSettingParameters,
  type UpdateSettingReturnType,
  updateSetting,
} from '../../actions/wallet/updateSetting.js'
import {
  type BuildUpdateTokenParameters,
  type BuildUpdateTokenReturnType,
  buildUpdateToken,
  type UpdateTokenParameters,
  type UpdateTokenReturnType,
  updateToken,
} from '../../actions/wallet/updateToken.js'
import {
  type BuildUpdateWitnessParameters,
  type BuildUpdateWitnessReturnType,
  buildUpdateWitness,
  type UpdateWitnessParameters,
  type UpdateWitnessReturnType,
  updateWitness,
} from '../../actions/wallet/updateWitness.js'
import {
  type BuildVoteProposalParameters,
  type BuildVoteProposalReturnType,
  buildVoteProposal,
  type VoteProposalParameters,
  type VoteProposalReturnType,
  voteProposal,
} from '../../actions/wallet/voteProposal.js'
import {
  type BuildVoteWitnessParameters,
  type BuildVoteWitnessReturnType,
  buildVoteWitness,
  type VoteWitnessParameters,
  type VoteWitnessReturnType,
  voteWitness,
} from '../../actions/wallet/voteWitness.js'
import {
  type BuildWithdrawBalanceParameters,
  type BuildWithdrawBalanceReturnType,
  buildWithdrawBalance,
  type WithdrawBalanceParameters,
  type WithdrawBalanceReturnType,
  withdrawBalance,
} from '../../actions/wallet/withdrawBalance.js'
import {
  type BuildWithdrawExpireUnfreezeParameters,
  type BuildWithdrawExpireUnfreezeReturnType,
  buildWithdrawExpireUnfreeze,
  type WithdrawExpireUnfreezeParameters,
  type WithdrawExpireUnfreezeReturnType,
  withdrawExpireUnfreeze,
} from '../../actions/wallet/withdrawExpireUnfreeze.js'
import {
  type BuildWriteContractParameters,
  type BuildWriteContractReturnType,
  buildWriteContract,
  type WriteContractParameters,
  type WriteContractReturnType,
  writeContract,
} from '../../actions/wallet/writeContract.js'
import { AccountNotFoundError } from '../../errors/rpc.js'
import type { ContractFunctionName } from '../../types/contract.js'
import type { Hex } from '../../types/misc.js'
import { getAction } from '../../utils/getAction.js'
import type { Client } from '../createClient.js'

export type WalletActions = {
  /** Sends TRX to a recipient. */
  sendTrx: (parameters: SendTrxParameters) => Promise<SendTrxReturnType>
  /** Builds an unsigned TRX transfer in TronWeb JSON shape (no sign/broadcast). */
  buildSendTrx: (
    parameters: BuildSendTrxParameters,
  ) => Promise<BuildSendTrxReturnType>
  /** Writes to (state-changing calls) a contract function. */
  writeContract: <
    const abi extends Abi | readonly unknown[],
    functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'>,
  >(
    parameters: WriteContractParameters<abi, functionName>,
  ) => Promise<WriteContractReturnType>
  /** Builds an unsigned contract write in TronWeb JSON shape (no sign/broadcast). */
  buildWriteContract: <
    const abi extends Abi | readonly unknown[],
    functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'>,
  >(
    parameters: BuildWriteContractParameters<abi, functionName>,
  ) => Promise<BuildWriteContractReturnType>
  /** Deploys a smart contract (local build → sign → broadcast). */
  deployContract: (
    parameters: DeployContractParameters,
  ) => Promise<DeployContractReturnType>
  /** Builds an unsigned contract deployment in TronWeb JSON shape (no sign/broadcast). */
  buildDeployContract: (
    parameters: BuildDeployContractParameters,
  ) => Promise<BuildDeployContractReturnType>
  /** Updates the account's owner/witness/active permissions (multi-sig setup). */
  accountPermissionUpdate: (
    parameters: AccountPermissionUpdateParameters,
  ) => Promise<AccountPermissionUpdateReturnType>
  /** Builds an unsigned account permission update in TronWeb JSON shape (no sign/broadcast). */
  buildAccountPermissionUpdate: (
    parameters: BuildAccountPermissionUpdateParameters,
  ) => Promise<BuildAccountPermissionUpdateReturnType>
  /** Co-signs a multi-sig transaction under a permission id (signs locally). */
  multiSign: (parameters: MultiSignParameters) => Promise<MultiSignReturnType>
  /** Signs a built transaction with the resolved account (guards included). */
  signTransaction: (
    parameters: SignTransactionParameters,
  ) => Promise<SignTransactionReturnType>
  /** Signs a message per TIP-191 with the resolved account. */
  signMessage: (
    parameters: SignMessageParameters,
  ) => Promise<SignMessageReturnType>
  /** Signs TIP-712 typed structured data with the resolved account. */
  signTypedData: (
    parameters: SignTypedDataParameters,
  ) => Promise<SignTypedDataReturnType>
  /** Broadcasts a locally-signed transaction. */
  broadcastTransaction: (
    parameters: BroadcastTransactionParameters,
  ) => Promise<BroadcastTransactionReturnType>
  /** Stakes (freezes) TRX for bandwidth or energy (Stake 2.0). */
  freezeBalanceV2: (
    parameters: FreezeBalanceV2Parameters,
  ) => Promise<FreezeBalanceV2ReturnType>
  /** Builds an unsigned Stake 2.0 freeze in TronWeb JSON shape (no sign/broadcast). */
  buildFreezeBalanceV2: (
    parameters: BuildFreezeBalanceV2Parameters,
  ) => Promise<BuildFreezeBalanceV2ReturnType>
  /** Unstakes (unfreezes) TRX previously frozen under Stake 2.0. */
  unfreezeBalanceV2: (
    parameters: UnfreezeBalanceV2Parameters,
  ) => Promise<UnfreezeBalanceV2ReturnType>
  /** Builds an unsigned Stake 2.0 unfreeze in TronWeb JSON shape (no sign/broadcast). */
  buildUnfreezeBalanceV2: (
    parameters: BuildUnfreezeBalanceV2Parameters,
  ) => Promise<BuildUnfreezeBalanceV2ReturnType>
  /** Cancels all pending Stake 2.0 unfreeze requests, re-staking them. */
  cancelAllUnfreezeV2: (
    parameters?: CancelAllUnfreezeV2Parameters,
  ) => Promise<CancelAllUnfreezeV2ReturnType>
  /** Builds an unsigned cancel-all-unfreeze in TronWeb JSON shape (no sign/broadcast). */
  buildCancelAllUnfreezeV2: (
    parameters?: BuildCancelAllUnfreezeV2Parameters,
  ) => Promise<BuildCancelAllUnfreezeV2ReturnType>
  /** Withdraws expired (matured) unfrozen TRX to the owner's balance. */
  withdrawExpireUnfreeze: (
    parameters?: WithdrawExpireUnfreezeParameters,
  ) => Promise<WithdrawExpireUnfreezeReturnType>
  /** Builds an unsigned withdraw-expired-unfreeze in TronWeb JSON shape (no sign/broadcast). */
  buildWithdrawExpireUnfreeze: (
    parameters?: BuildWithdrawExpireUnfreezeParameters,
  ) => Promise<BuildWithdrawExpireUnfreezeReturnType>
  /** Delegates bandwidth or energy resource to another account. */
  delegateResource: (
    parameters: DelegateResourceParameters,
  ) => Promise<DelegateResourceReturnType>
  /** Builds an unsigned resource delegation in TronWeb JSON shape (no sign/broadcast). */
  buildDelegateResource: (
    parameters: BuildDelegateResourceParameters,
  ) => Promise<BuildDelegateResourceReturnType>
  /** Reclaims resource previously delegated to another account. */
  undelegateResource: (
    parameters: UndelegateResourceParameters,
  ) => Promise<UndelegateResourceReturnType>
  /** Builds an unsigned resource undelegation in TronWeb JSON shape (no sign/broadcast). */
  buildUndelegateResource: (
    parameters: BuildUndelegateResourceParameters,
  ) => Promise<BuildUndelegateResourceReturnType>
  /** Votes for super representatives (witnesses) with TRON Power. */
  voteWitness: (
    parameters: VoteWitnessParameters,
  ) => Promise<VoteWitnessReturnType>
  /** Builds an unsigned witness vote in TronWeb JSON shape (no sign/broadcast). */
  buildVoteWitness: (
    parameters: BuildVoteWitnessParameters,
  ) => Promise<BuildVoteWitnessReturnType>
  /** Withdraws accumulated voting/SR rewards to the owner's balance. */
  withdrawBalance: (
    parameters?: WithdrawBalanceParameters,
  ) => Promise<WithdrawBalanceReturnType>
  /** Builds an unsigned reward withdrawal in TronWeb JSON shape (no sign/broadcast). */
  buildWithdrawBalance: (
    parameters?: BuildWithdrawBalanceParameters,
  ) => Promise<BuildWithdrawBalanceReturnType>
  /** Sets a super representative's brokerage ratio (0..100). */
  updateBrokerage: (
    parameters: UpdateBrokerageParameters,
  ) => Promise<UpdateBrokerageReturnType>
  /** Builds an unsigned brokerage update in TronWeb JSON shape (no sign/broadcast). */
  buildUpdateBrokerage: (
    parameters: BuildUpdateBrokerageParameters,
  ) => Promise<BuildUpdateBrokerageReturnType>
  /** Creates a new (unactivated) account on-chain. */
  createAccount: (
    parameters: CreateAccountParameters,
  ) => Promise<CreateAccountReturnType>
  /** Builds an unsigned account creation in TronWeb JSON shape (no sign/broadcast). */
  buildCreateAccount: (
    parameters: BuildCreateAccountParameters,
  ) => Promise<BuildCreateAccountReturnType>
  /** Sets the account's on-chain name. */
  updateAccount: (
    parameters: UpdateAccountParameters,
  ) => Promise<UpdateAccountReturnType>
  /** Builds an unsigned account-name update in TronWeb JSON shape (no sign/broadcast). */
  buildUpdateAccount: (
    parameters: BuildUpdateAccountParameters,
  ) => Promise<BuildUpdateAccountReturnType>
  /** Sets a unique on-chain account id. */
  setAccountId: (
    parameters: SetAccountIdParameters,
  ) => Promise<SetAccountIdReturnType>
  /** Builds an unsigned account-id set in TronWeb JSON shape (no sign/broadcast). */
  buildSetAccountId: (
    parameters: BuildSetAccountIdParameters,
  ) => Promise<BuildSetAccountIdReturnType>
  /** Applies to become a super representative (witness). */
  applyForSr: (
    parameters: ApplyForSrParameters,
  ) => Promise<ApplyForSrReturnType>
  /** Builds an unsigned SR application in TronWeb JSON shape (no sign/broadcast). */
  buildApplyForSr: (
    parameters: BuildApplyForSrParameters,
  ) => Promise<BuildApplyForSrReturnType>
  /** Updates a super representative's page URL. */
  updateWitness: (
    parameters: UpdateWitnessParameters,
  ) => Promise<UpdateWitnessReturnType>
  /** Builds an unsigned witness-URL update in TronWeb JSON shape (no sign/broadcast). */
  buildUpdateWitness: (
    parameters: BuildUpdateWitnessParameters,
  ) => Promise<BuildUpdateWitnessReturnType>
  /** Clears a smart contract's on-chain ABI. */
  clearAbi: (parameters: ClearAbiParameters) => Promise<ClearAbiReturnType>
  /** Builds an unsigned ABI clear in TronWeb JSON shape (no sign/broadcast). */
  buildClearAbi: (
    parameters: BuildClearAbiParameters,
  ) => Promise<BuildClearAbiReturnType>
  /** Updates a smart contract's user resource-consumption percentage. */
  updateSetting: (
    parameters: UpdateSettingParameters,
  ) => Promise<UpdateSettingReturnType>
  /** Builds an unsigned contract-setting update in TronWeb JSON shape (no sign/broadcast). */
  buildUpdateSetting: (
    parameters: BuildUpdateSettingParameters,
  ) => Promise<BuildUpdateSettingReturnType>
  /** Updates a smart contract's creator energy limit. */
  updateEnergyLimit: (
    parameters: UpdateEnergyLimitParameters,
  ) => Promise<UpdateEnergyLimitReturnType>
  /** Builds an unsigned energy-limit update in TronWeb JSON shape (no sign/broadcast). */
  buildUpdateEnergyLimit: (
    parameters: BuildUpdateEnergyLimitParameters,
  ) => Promise<BuildUpdateEnergyLimitReturnType>
  /** Sends a TRC10 asset to a recipient. */
  sendTrc10: (parameters: SendTrc10Parameters) => Promise<SendTrc10ReturnType>
  /** Builds an unsigned TRC10 transfer in TronWeb JSON shape (no sign/broadcast). */
  buildSendTrc10: (
    parameters: BuildSendTrc10Parameters,
  ) => Promise<BuildSendTrc10ReturnType>
  /** Stakes (freezes) TRX for bandwidth or energy (Stake 1.0). */
  freezeBalance: (
    parameters: FreezeBalanceParameters,
  ) => Promise<FreezeBalanceReturnType>
  /** Builds an unsigned Stake 1.0 freeze in TronWeb JSON shape (no sign/broadcast). */
  buildFreezeBalance: (
    parameters: BuildFreezeBalanceParameters,
  ) => Promise<BuildFreezeBalanceReturnType>
  /** Unstakes (unfreezes) TRX previously frozen under Stake 1.0. */
  unfreezeBalance: (
    parameters: UnfreezeBalanceParameters,
  ) => Promise<UnfreezeBalanceReturnType>
  /** Builds an unsigned Stake 1.0 unfreeze in TronWeb JSON shape (no sign/broadcast). */
  buildUnfreezeBalance: (
    parameters: BuildUnfreezeBalanceParameters,
  ) => Promise<BuildUnfreezeBalanceReturnType>
  /** Buys (participates in) a TRC10 token issuance. */
  purchaseToken: (
    parameters: PurchaseTokenParameters,
  ) => Promise<PurchaseTokenReturnType>
  /** Builds an unsigned TRC10 token purchase in TronWeb JSON shape (no sign/broadcast). */
  buildPurchaseToken: (
    parameters: BuildPurchaseTokenParameters,
  ) => Promise<BuildPurchaseTokenReturnType>
  /** Issues (creates) a TRC10 token. */
  createToken: (
    parameters: CreateTokenParameters,
  ) => Promise<CreateTokenReturnType>
  /** Builds an unsigned TRC10 token issuance in TronWeb JSON shape (no sign/broadcast). */
  buildCreateToken: (
    parameters: BuildCreateTokenParameters,
  ) => Promise<BuildCreateTokenReturnType>
  /** Updates a TRC10 token's description, URL and free-bandwidth settings. */
  updateToken: (
    parameters: UpdateTokenParameters,
  ) => Promise<UpdateTokenReturnType>
  /** Builds an unsigned TRC10 token update in TronWeb JSON shape (no sign/broadcast). */
  buildUpdateToken: (
    parameters: BuildUpdateTokenParameters,
  ) => Promise<BuildUpdateTokenReturnType>
  /** Creates a governance proposal to change chain parameters. */
  createProposal: (
    parameters: CreateProposalParameters,
  ) => Promise<CreateProposalReturnType>
  /** Builds an unsigned proposal creation in TronWeb JSON shape (no sign/broadcast). */
  buildCreateProposal: (
    parameters: BuildCreateProposalParameters,
  ) => Promise<BuildCreateProposalReturnType>
  /** Approves (or disapproves) a governance proposal. */
  voteProposal: (
    parameters: VoteProposalParameters,
  ) => Promise<VoteProposalReturnType>
  /** Builds an unsigned proposal vote in TronWeb JSON shape (no sign/broadcast). */
  buildVoteProposal: (
    parameters: BuildVoteProposalParameters,
  ) => Promise<BuildVoteProposalReturnType>
  /** Deletes a governance proposal. */
  deleteProposal: (
    parameters: DeleteProposalParameters,
  ) => Promise<DeleteProposalReturnType>
  /** Builds an unsigned proposal deletion in TronWeb JSON shape (no sign/broadcast). */
  buildDeleteProposal: (
    parameters: BuildDeleteProposalParameters,
  ) => Promise<BuildDeleteProposalReturnType>
  /** Creates a Bancor exchange (trading pair). */
  exchangeCreate: (
    parameters: ExchangeCreateParameters,
  ) => Promise<ExchangeCreateReturnType>
  /** Builds an unsigned exchange creation in TronWeb JSON shape (no sign/broadcast). */
  buildExchangeCreate: (
    parameters: BuildExchangeCreateParameters,
  ) => Promise<BuildExchangeCreateReturnType>
  /** Injects liquidity into a Bancor exchange. */
  exchangeInject: (
    parameters: ExchangeInjectParameters,
  ) => Promise<ExchangeInjectReturnType>
  /** Builds an unsigned exchange injection in TronWeb JSON shape (no sign/broadcast). */
  buildExchangeInject: (
    parameters: BuildExchangeInjectParameters,
  ) => Promise<BuildExchangeInjectReturnType>
  /** Withdraws liquidity from a Bancor exchange. */
  exchangeWithdraw: (
    parameters: ExchangeWithdrawParameters,
  ) => Promise<ExchangeWithdrawReturnType>
  /** Builds an unsigned exchange withdrawal in TronWeb JSON shape (no sign/broadcast). */
  buildExchangeWithdraw: (
    parameters: BuildExchangeWithdrawParameters,
  ) => Promise<BuildExchangeWithdrawReturnType>
  /** Trades against a Bancor exchange. */
  exchangeTransaction: (
    parameters: ExchangeTransactionParameters,
  ) => Promise<ExchangeTransactionReturnType>
  /** Builds an unsigned exchange trade in TronWeb JSON shape (no sign/broadcast). */
  buildExchangeTransaction: (
    parameters: BuildExchangeTransactionParameters,
  ) => Promise<BuildExchangeTransactionReturnType>
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
    buildSendTrx: async (parameters) =>
      getAction(
        client,
        buildSendTrx,
        'buildSendTrx',
      )(requireAccount(client, parameters)),
    // The two generic contract actions: getAction erases the action's type
    // parameters (it sees the wide instantiation), so the parameters are
    // widened explicitly; the return types are not generic.
    writeContract: async <
      const abi extends Abi | readonly unknown[],
      functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'>,
    >(
      parameters: WriteContractParameters<abi, functionName>,
    ) =>
      getAction(
        client,
        writeContract,
        'writeContract',
      )(requireAccount(client, parameters as WriteContractParameters)),
    buildWriteContract: async <
      const abi extends Abi | readonly unknown[],
      functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'>,
    >(
      parameters: BuildWriteContractParameters<abi, functionName>,
    ) =>
      getAction(
        client,
        buildWriteContract,
        'buildWriteContract',
      )(requireAccount(client, parameters as BuildWriteContractParameters)),
    deployContract: async (parameters) =>
      getAction(
        client,
        deployContract,
        'deployContract',
      )(requireAccount(client, parameters)),
    buildDeployContract: async (parameters) =>
      getAction(
        client,
        buildDeployContract,
        'buildDeployContract',
      )(requireAccount(client, parameters)),
    accountPermissionUpdate: async (parameters) =>
      getAction(
        client,
        accountPermissionUpdate,
        'accountPermissionUpdate',
      )(requireAccount(client, parameters)),
    buildAccountPermissionUpdate: async (parameters) =>
      getAction(
        client,
        buildAccountPermissionUpdate,
        'buildAccountPermissionUpdate',
      )(requireAccount(client, parameters)),
    // Takes a raw `privateKey` (not an account), so it bypasses `requireAccount`.
    multiSign: (parameters) =>
      getAction(client, multiSign, 'multiSign')(parameters),
    signTransaction: async (parameters) =>
      getAction(
        client,
        signTransaction,
        'signTransaction',
      )(requireAccount(client, parameters)),
    signMessage: async (parameters) =>
      getAction(
        client,
        signMessage,
        'signMessage',
      )(requireAccount(client, parameters)),
    signTypedData: async (parameters) =>
      getAction(
        client,
        signTypedData,
        'signTypedData',
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
    buildFreezeBalanceV2: async (parameters) =>
      getAction(
        client,
        buildFreezeBalanceV2,
        'buildFreezeBalanceV2',
      )(requireAccount(client, parameters)),
    unfreezeBalanceV2: async (parameters) =>
      getAction(
        client,
        unfreezeBalanceV2,
        'unfreezeBalanceV2',
      )(requireAccount(client, parameters)),
    buildUnfreezeBalanceV2: async (parameters) =>
      getAction(
        client,
        buildUnfreezeBalanceV2,
        'buildUnfreezeBalanceV2',
      )(requireAccount(client, parameters)),
    cancelAllUnfreezeV2: async (parameters = {}) =>
      getAction(
        client,
        cancelAllUnfreezeV2,
        'cancelAllUnfreezeV2',
      )(requireAccount(client, parameters)),
    buildCancelAllUnfreezeV2: async (parameters = {}) =>
      getAction(
        client,
        buildCancelAllUnfreezeV2,
        'buildCancelAllUnfreezeV2',
      )(requireAccount(client, parameters)),
    withdrawExpireUnfreeze: async (parameters = {}) =>
      getAction(
        client,
        withdrawExpireUnfreeze,
        'withdrawExpireUnfreeze',
      )(requireAccount(client, parameters)),
    buildWithdrawExpireUnfreeze: async (parameters = {}) =>
      getAction(
        client,
        buildWithdrawExpireUnfreeze,
        'buildWithdrawExpireUnfreeze',
      )(requireAccount(client, parameters)),
    delegateResource: async (parameters) =>
      getAction(
        client,
        delegateResource,
        'delegateResource',
      )(requireAccount(client, parameters)),
    buildDelegateResource: async (parameters) =>
      getAction(
        client,
        buildDelegateResource,
        'buildDelegateResource',
      )(requireAccount(client, parameters)),
    undelegateResource: async (parameters) =>
      getAction(
        client,
        undelegateResource,
        'undelegateResource',
      )(requireAccount(client, parameters)),
    buildUndelegateResource: async (parameters) =>
      getAction(
        client,
        buildUndelegateResource,
        'buildUndelegateResource',
      )(requireAccount(client, parameters)),
    voteWitness: async (parameters) =>
      getAction(
        client,
        voteWitness,
        'voteWitness',
      )(requireAccount(client, parameters)),
    buildVoteWitness: async (parameters) =>
      getAction(
        client,
        buildVoteWitness,
        'buildVoteWitness',
      )(requireAccount(client, parameters)),
    withdrawBalance: async (parameters = {}) =>
      getAction(
        client,
        withdrawBalance,
        'withdrawBalance',
      )(requireAccount(client, parameters)),
    buildWithdrawBalance: async (parameters = {}) =>
      getAction(
        client,
        buildWithdrawBalance,
        'buildWithdrawBalance',
      )(requireAccount(client, parameters)),
    updateBrokerage: async (parameters) =>
      getAction(
        client,
        updateBrokerage,
        'updateBrokerage',
      )(requireAccount(client, parameters)),
    buildUpdateBrokerage: async (parameters) =>
      getAction(
        client,
        buildUpdateBrokerage,
        'buildUpdateBrokerage',
      )(requireAccount(client, parameters)),
    createAccount: async (parameters) =>
      getAction(
        client,
        createAccount,
        'createAccount',
      )(requireAccount(client, parameters)),
    buildCreateAccount: async (parameters) =>
      getAction(
        client,
        buildCreateAccount,
        'buildCreateAccount',
      )(requireAccount(client, parameters)),
    updateAccount: async (parameters) =>
      getAction(
        client,
        updateAccount,
        'updateAccount',
      )(requireAccount(client, parameters)),
    buildUpdateAccount: async (parameters) =>
      getAction(
        client,
        buildUpdateAccount,
        'buildUpdateAccount',
      )(requireAccount(client, parameters)),
    setAccountId: async (parameters) =>
      getAction(
        client,
        setAccountId,
        'setAccountId',
      )(requireAccount(client, parameters)),
    buildSetAccountId: async (parameters) =>
      getAction(
        client,
        buildSetAccountId,
        'buildSetAccountId',
      )(requireAccount(client, parameters)),
    applyForSr: async (parameters) =>
      getAction(
        client,
        applyForSr,
        'applyForSr',
      )(requireAccount(client, parameters)),
    buildApplyForSr: async (parameters) =>
      getAction(
        client,
        buildApplyForSr,
        'buildApplyForSr',
      )(requireAccount(client, parameters)),
    updateWitness: async (parameters) =>
      getAction(
        client,
        updateWitness,
        'updateWitness',
      )(requireAccount(client, parameters)),
    buildUpdateWitness: async (parameters) =>
      getAction(
        client,
        buildUpdateWitness,
        'buildUpdateWitness',
      )(requireAccount(client, parameters)),
    clearAbi: async (parameters) =>
      getAction(
        client,
        clearAbi,
        'clearAbi',
      )(requireAccount(client, parameters)),
    buildClearAbi: async (parameters) =>
      getAction(
        client,
        buildClearAbi,
        'buildClearAbi',
      )(requireAccount(client, parameters)),
    updateSetting: async (parameters) =>
      getAction(
        client,
        updateSetting,
        'updateSetting',
      )(requireAccount(client, parameters)),
    buildUpdateSetting: async (parameters) =>
      getAction(
        client,
        buildUpdateSetting,
        'buildUpdateSetting',
      )(requireAccount(client, parameters)),
    updateEnergyLimit: async (parameters) =>
      getAction(
        client,
        updateEnergyLimit,
        'updateEnergyLimit',
      )(requireAccount(client, parameters)),
    buildUpdateEnergyLimit: async (parameters) =>
      getAction(
        client,
        buildUpdateEnergyLimit,
        'buildUpdateEnergyLimit',
      )(requireAccount(client, parameters)),
    sendTrc10: async (parameters) =>
      getAction(
        client,
        sendTrc10,
        'sendTrc10',
      )(requireAccount(client, parameters)),
    buildSendTrc10: async (parameters) =>
      getAction(
        client,
        buildSendTrc10,
        'buildSendTrc10',
      )(requireAccount(client, parameters)),
    freezeBalance: async (parameters) =>
      getAction(
        client,
        freezeBalance,
        'freezeBalance',
      )(requireAccount(client, parameters)),
    buildFreezeBalance: async (parameters) =>
      getAction(
        client,
        buildFreezeBalance,
        'buildFreezeBalance',
      )(requireAccount(client, parameters)),
    unfreezeBalance: async (parameters) =>
      getAction(
        client,
        unfreezeBalance,
        'unfreezeBalance',
      )(requireAccount(client, parameters)),
    buildUnfreezeBalance: async (parameters) =>
      getAction(
        client,
        buildUnfreezeBalance,
        'buildUnfreezeBalance',
      )(requireAccount(client, parameters)),
    purchaseToken: async (parameters) =>
      getAction(
        client,
        purchaseToken,
        'purchaseToken',
      )(requireAccount(client, parameters)),
    buildPurchaseToken: async (parameters) =>
      getAction(
        client,
        buildPurchaseToken,
        'buildPurchaseToken',
      )(requireAccount(client, parameters)),
    createToken: async (parameters) =>
      getAction(
        client,
        createToken,
        'createToken',
      )(requireAccount(client, parameters)),
    buildCreateToken: async (parameters) =>
      getAction(
        client,
        buildCreateToken,
        'buildCreateToken',
      )(requireAccount(client, parameters)),
    updateToken: async (parameters) =>
      getAction(
        client,
        updateToken,
        'updateToken',
      )(requireAccount(client, parameters)),
    buildUpdateToken: async (parameters) =>
      getAction(
        client,
        buildUpdateToken,
        'buildUpdateToken',
      )(requireAccount(client, parameters)),
    createProposal: async (parameters) =>
      getAction(
        client,
        createProposal,
        'createProposal',
      )(requireAccount(client, parameters)),
    buildCreateProposal: async (parameters) =>
      getAction(
        client,
        buildCreateProposal,
        'buildCreateProposal',
      )(requireAccount(client, parameters)),
    voteProposal: async (parameters) =>
      getAction(
        client,
        voteProposal,
        'voteProposal',
      )(requireAccount(client, parameters)),
    buildVoteProposal: async (parameters) =>
      getAction(
        client,
        buildVoteProposal,
        'buildVoteProposal',
      )(requireAccount(client, parameters)),
    deleteProposal: async (parameters) =>
      getAction(
        client,
        deleteProposal,
        'deleteProposal',
      )(requireAccount(client, parameters)),
    buildDeleteProposal: async (parameters) =>
      getAction(
        client,
        buildDeleteProposal,
        'buildDeleteProposal',
      )(requireAccount(client, parameters)),
    exchangeCreate: async (parameters) =>
      getAction(
        client,
        exchangeCreate,
        'exchangeCreate',
      )(requireAccount(client, parameters)),
    buildExchangeCreate: async (parameters) =>
      getAction(
        client,
        buildExchangeCreate,
        'buildExchangeCreate',
      )(requireAccount(client, parameters)),
    exchangeInject: async (parameters) =>
      getAction(
        client,
        exchangeInject,
        'exchangeInject',
      )(requireAccount(client, parameters)),
    buildExchangeInject: async (parameters) =>
      getAction(
        client,
        buildExchangeInject,
        'buildExchangeInject',
      )(requireAccount(client, parameters)),
    exchangeWithdraw: async (parameters) =>
      getAction(
        client,
        exchangeWithdraw,
        'exchangeWithdraw',
      )(requireAccount(client, parameters)),
    buildExchangeWithdraw: async (parameters) =>
      getAction(
        client,
        buildExchangeWithdraw,
        'buildExchangeWithdraw',
      )(requireAccount(client, parameters)),
    exchangeTransaction: async (parameters) =>
      getAction(
        client,
        exchangeTransaction,
        'exchangeTransaction',
      )(requireAccount(client, parameters)),
    buildExchangeTransaction: async (parameters) =>
      getAction(
        client,
        buildExchangeTransaction,
        'buildExchangeTransaction',
      )(requireAccount(client, parameters)),
  }
}
