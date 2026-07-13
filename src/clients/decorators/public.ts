// Structure vendored (de-branded) and adapted for TRON: the action set is
// TRON's read pipeline and each method is bound through `getAction` so a
// consumer can override any action on the Client.

import {
  type EstimateEnergyParameters,
  type EstimateEnergyReturnType,
  estimateEnergy,
} from '../../actions/public/estimateEnergy.js'
import {
  type GetAccountResourcesParameters,
  type GetAccountResourcesReturnType,
  getAccountResources,
} from '../../actions/public/getAccountResources.js'
import {
  type GetApprovedListParameters,
  type GetApprovedListReturnType,
  getApprovedList,
} from '../../actions/public/getApprovedList.js'
import {
  type GetBalanceParameters,
  type GetBalanceReturnType,
  getBalance,
} from '../../actions/public/getBalance.js'
import {
  type GetBlockParameters,
  type GetBlockReturnType,
  getBlock,
} from '../../actions/public/getBlock.js'
import {
  type GetChainParametersReturnType,
  getChainParameters,
} from '../../actions/public/getChainParameters.js'
import {
  type GetNowBlockReturnType,
  getNowBlock,
} from '../../actions/public/getNowBlock.js'
import {
  type GetSignWeightParameters,
  type GetSignWeightReturnType,
  getSignWeight,
} from '../../actions/public/getSignWeight.js'
import {
  type GetTransactionInfoParameters,
  type GetTransactionInfoReturnType,
  getTransactionInfo,
} from '../../actions/public/getTransactionInfo.js'
import {
  type ReadContractParameters,
  type ReadContractReturnType,
  readContract,
} from '../../actions/public/readContract.js'
import {
  type WaitForTransactionReceiptParameters,
  type WaitForTransactionReceiptReturnType,
  waitForTransactionReceipt,
} from '../../actions/public/waitForTransactionReceipt.js'
import { getAction } from '../../utils/getAction.js'
import type { Client } from '../createClient.js'

export type PublicActions = {
  /** Reads the TRX balance (in SUN) of an account. */
  getBalance: (
    parameters: GetBalanceParameters,
  ) => Promise<GetBalanceReturnType>
  /** Reads an account's resource (bandwidth/energy/TRON-power) usage/limits. */
  getAccountResources: (
    parameters: GetAccountResourcesParameters,
  ) => Promise<GetAccountResourcesReturnType>
  /** Fetches a block by number. */
  getBlock: (parameters: GetBlockParameters) => Promise<GetBlockReturnType>
  /** Fetches the latest (unconfirmed) block. */
  getNowBlock: () => Promise<GetNowBlockReturnType>
  /** Fetches a transaction's receipt / execution info. */
  getTransactionInfo: (
    parameters: GetTransactionInfoParameters,
  ) => Promise<GetTransactionInfoReturnType>
  /** Fetches the chain parameters. */
  getChainParameters: () => Promise<GetChainParametersReturnType>
  /** Reads (constant-calls) a contract function. */
  readContract: (
    parameters: ReadContractParameters,
  ) => Promise<ReadContractReturnType>
  /** Estimates the energy a contract call would consume. */
  estimateEnergy: (
    parameters: EstimateEnergyParameters,
  ) => Promise<EstimateEnergyReturnType>
  /** Polls for a transaction's receipt. */
  waitForTransactionReceipt: (
    parameters: WaitForTransactionReceiptParameters,
  ) => Promise<WaitForTransactionReceiptReturnType>
  /** Reads the accumulated signature weight of a multi-sig transaction. */
  getSignWeight: (
    parameters: GetSignWeightParameters,
  ) => Promise<GetSignWeightReturnType>
  /** Reads which addresses have signed a multi-sig transaction. */
  getApprovedList: (
    parameters: GetApprovedListParameters,
  ) => Promise<GetApprovedListReturnType>
}

/**
 * The TRON read (public) action set. Each action is bound to `client` through
 * {@link getAction}, so a consumer may override any of them on the Client and
 * the others will call the overridden implementation.
 */
export function publicActions(client: Client): PublicActions {
  return {
    getBalance: (parameters) =>
      getAction(client, getBalance, 'getBalance')(parameters),
    getAccountResources: (parameters) =>
      getAction(client, getAccountResources, 'getAccountResources')(parameters),
    getBlock: (parameters) =>
      getAction(client, getBlock, 'getBlock')(parameters),
    getNowBlock: () =>
      getAction(client, getNowBlock, 'getNowBlock')(undefined as never),
    getTransactionInfo: (parameters) =>
      getAction(client, getTransactionInfo, 'getTransactionInfo')(parameters),
    getChainParameters: () =>
      getAction(
        client,
        getChainParameters,
        'getChainParameters',
      )(undefined as never),
    readContract: (parameters) =>
      getAction(client, readContract, 'readContract')(parameters),
    estimateEnergy: (parameters) =>
      getAction(client, estimateEnergy, 'estimateEnergy')(parameters),
    waitForTransactionReceipt: (parameters) =>
      getAction(
        client,
        waitForTransactionReceipt,
        'waitForTransactionReceipt',
      )(parameters),
    getSignWeight: (parameters) =>
      getAction(client, getSignWeight, 'getSignWeight')(parameters),
    getApprovedList: (parameters) =>
      getAction(client, getApprovedList, 'getApprovedList')(parameters),
  }
}
