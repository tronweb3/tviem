import {
  type EstimateEnergyParameters,
  type EstimateEnergyReturnType,
  estimateEnergy,
} from '../../actions/public/estimateEnergy.js'
import {
  type GetAccountParameters,
  type GetAccountReturnType,
  getAccount,
} from '../../actions/public/getAccount.js'
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
  type GetContractEventsParameters,
  type GetContractEventsReturnType,
  getContractEvents,
} from '../../actions/public/getContractEvents.js'
import {
  type GetEventsByBlockNumberParameters,
  type GetEventsByBlockNumberReturnType,
  getEventsByBlockNumber,
} from '../../actions/public/getEventsByBlockNumber.js'
import {
  type GetEventsByContractAddressParameters,
  type GetEventsByContractAddressReturnType,
  getEventsByContractAddress,
} from '../../actions/public/getEventsByContractAddress.js'
import {
  type GetEventsByTransactionIDParameters,
  type GetEventsByTransactionIDReturnType,
  getEventsByTransactionID,
} from '../../actions/public/getEventsByTransactionID.js'
import {
  type GetEventsOfLatestBlockParameters,
  type GetEventsOfLatestBlockReturnType,
  getEventsOfLatestBlock,
} from '../../actions/public/getEventsOfLatestBlock.js'
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
  type GetTransactionParameters,
  type GetTransactionReturnType,
  getTransaction,
} from '../../actions/public/getTransaction.js'
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
  /** Reads an account's full on-chain state (balance, stake, votes, permissions). */
  getAccount: (
    parameters: GetAccountParameters,
  ) => Promise<GetAccountReturnType>
  /** Reads an account's resource (bandwidth/energy/TRON-power) usage/limits. */
  getAccountResources: (
    parameters: GetAccountResourcesParameters,
  ) => Promise<GetAccountResourcesReturnType>
  /** Fetches a block by number. */
  getBlock: (parameters: GetBlockParameters) => Promise<GetBlockReturnType>
  /** Reads a contract's events (ABI-typed `eventName`) via the TronGrid `/v1` index. */
  getContractEvents: (
    parameters: GetContractEventsParameters,
  ) => Promise<GetContractEventsReturnType>
  /** Reads a contract's events from the TronGrid `/v1` index. */
  getEventsByContractAddress: (
    parameters: GetEventsByContractAddressParameters,
  ) => Promise<GetEventsByContractAddressReturnType>
  /** Reads every event a transaction emitted. */
  getEventsByTransactionID: (
    parameters: GetEventsByTransactionIDParameters,
  ) => Promise<GetEventsByTransactionIDReturnType>
  /** Reads every event emitted in a block. */
  getEventsByBlockNumber: (
    parameters: GetEventsByBlockNumberParameters,
  ) => Promise<GetEventsByBlockNumberReturnType>
  /** Reads every event emitted in the latest block. */
  getEventsOfLatestBlock: (
    parameters?: GetEventsOfLatestBlockParameters,
  ) => Promise<GetEventsOfLatestBlockReturnType>
  /** Fetches the latest (unconfirmed) block. */
  getNowBlock: () => Promise<GetNowBlockReturnType>
  /** Fetches a transaction by id (the original transaction, not its receipt). */
  getTransaction: (
    parameters: GetTransactionParameters,
  ) => Promise<GetTransactionReturnType>
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
    getAccount: (parameters) =>
      getAction(client, getAccount, 'getAccount')(parameters),
    getAccountResources: (parameters) =>
      getAction(client, getAccountResources, 'getAccountResources')(parameters),
    getBlock: (parameters) =>
      getAction(client, getBlock, 'getBlock')(parameters),
    getContractEvents: (parameters) =>
      getAction(client, getContractEvents, 'getContractEvents')(parameters),
    getEventsByContractAddress: (parameters) =>
      getAction(
        client,
        getEventsByContractAddress,
        'getEventsByContractAddress',
      )(parameters),
    getEventsByTransactionID: (parameters) =>
      getAction(
        client,
        getEventsByTransactionID,
        'getEventsByTransactionID',
      )(parameters),
    getEventsByBlockNumber: (parameters) =>
      getAction(
        client,
        getEventsByBlockNumber,
        'getEventsByBlockNumber',
      )(parameters),
    getEventsOfLatestBlock: (parameters = {}) =>
      getAction(
        client,
        getEventsOfLatestBlock,
        'getEventsOfLatestBlock',
      )(parameters),
    getNowBlock: () =>
      getAction(client, getNowBlock, 'getNowBlock')(undefined as never),
    getTransaction: (parameters) =>
      getAction(client, getTransaction, 'getTransaction')(parameters),
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
