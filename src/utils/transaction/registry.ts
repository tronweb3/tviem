import type { ByteArray } from '../../types/misc.js'
import { bareHex } from '../encoding/bareHex.js'
import {
  decodeAccountCreateContract,
  decodeAccountUpdateContract,
  decodeSetAccountIdContract,
  encodeAccountCreateContract,
  encodeAccountUpdateContract,
  encodeSetAccountIdContract,
} from './contracts/account.js'
import {
  decodeAssetIssueContract,
  decodeParticipateAssetIssueContract,
  decodeUpdateAssetContract,
  encodeAssetIssueContract,
  encodeParticipateAssetIssueContract,
  encodeUpdateAssetContract,
} from './contracts/asset.js'
import {
  decodeCancelAllUnfreezeV2Contract,
  decodeFreezeBalanceV2Contract,
  decodeUnfreezeBalanceV2Contract,
  decodeWithdrawBalanceContract,
  decodeWithdrawExpireUnfreezeContract,
  encodeCancelAllUnfreezeV2Contract,
  encodeFreezeBalanceV2Contract,
  encodeUnfreezeBalanceV2Contract,
  encodeWithdrawBalanceContract,
  encodeWithdrawExpireUnfreezeContract,
} from './contracts/balance.js'
import {
  decodeClearABIContract,
  decodeUpdateEnergyLimitContract,
  decodeUpdateSettingContract,
  encodeClearABIContract,
  encodeUpdateEnergyLimitContract,
  encodeUpdateSettingContract,
} from './contracts/contractAdmin.js'
import {
  decodeExchangeCreateContract,
  decodeExchangeInjectContract,
  decodeExchangeTransactionContract,
  decodeExchangeWithdrawContract,
  encodeExchangeCreateContract,
  encodeExchangeInjectContract,
  encodeExchangeTransactionContract,
  encodeExchangeWithdrawContract,
} from './contracts/exchange.js'
import {
  decodeAccountPermissionUpdateContract,
  encodeAccountPermissionUpdateContract,
} from './contracts/permission.js'
import {
  decodeProposalApproveContract,
  decodeProposalCreateContract,
  decodeProposalDeleteContract,
  encodeProposalApproveContract,
  encodeProposalCreateContract,
  encodeProposalDeleteContract,
} from './contracts/proposal.js'
import {
  decodeDelegateResourceContract,
  decodeUnDelegateResourceContract,
  encodeDelegateResourceContract,
  encodeUnDelegateResourceContract,
} from './contracts/resource.js'
import {
  decodeCreateSmartContract,
  decodeTriggerSmartContract,
  encodeCreateSmartContract,
  encodeTriggerSmartContract,
} from './contracts/smartContract.js'
import {
  decodeFreezeBalanceContract,
  decodeUnfreezeBalanceContract,
  encodeFreezeBalanceContract,
  encodeUnfreezeBalanceContract,
} from './contracts/stake1.js'
import {
  decodeTransferAssetContract,
  decodeTransferContract,
  encodeTransferAssetContract,
  encodeTransferContract,
} from './contracts/transfer.js'
import {
  decodeVoteWitnessContract,
  encodeVoteWitnessContract,
} from './contracts/vote.js'
import {
  decodeUpdateBrokerageContract,
  decodeWitnessCreateContract,
  decodeWitnessUpdateContract,
  encodeUpdateBrokerageContract,
  encodeWitnessCreateContract,
  encodeWitnessUpdateContract,
} from './contracts/witness.js'
import type { ContractMessage, UnknownContractParameter } from './types.js'

/** `Transaction.Contract.ContractType` integers (v0.1 contract set). */
export const ContractType = {
  AccountCreateContract: 0,
  TransferContract: 1,
  TransferAssetContract: 2,
  VoteWitnessContract: 4,
  WitnessCreateContract: 5,
  AssetIssueContract: 6,
  WitnessUpdateContract: 8,
  ParticipateAssetIssueContract: 9,
  ProposalCreateContract: 16,
  ProposalApproveContract: 17,
  ProposalDeleteContract: 18,
  ExchangeCreateContract: 41,
  ExchangeInjectContract: 42,
  ExchangeWithdrawContract: 43,
  ExchangeTransactionContract: 44,
  AccountUpdateContract: 10,
  FreezeBalanceContract: 11,
  UnfreezeBalanceContract: 12,
  WithdrawBalanceContract: 13,
  UpdateAssetContract: 15,
  SetAccountIdContract: 19,
  CreateSmartContract: 30,
  TriggerSmartContract: 31,
  UpdateSettingContract: 33,
  UpdateEnergyLimitContract: 45,
  AccountPermissionUpdateContract: 46,
  ClearABIContract: 48,
  FreezeBalanceV2Contract: 54,
  UnfreezeBalanceV2Contract: 55,
  WithdrawExpireUnfreezeContract: 56,
  DelegateResourceContract: 57,
  UnDelegateResourceContract: 58,
  CancelAllUnfreezeV2Contract: 59,
  UpdateBrokerageContract: 49,
} as const
export type ContractType = (typeof ContractType)[keyof typeof ContractType]

/** A registered `Transaction.Contract.type` enum name. */
export type ContractTypeName = keyof typeof ContractType

const contractTypeNames = new Map<number, ContractTypeName>(
  (Object.entries(ContractType) as [ContractTypeName, number][]).map(
    ([name, type]) => [type, name],
  ),
)

/**
 * Resolves a `Transaction.Contract.type` integer to its enum name — the
 * string java-tron's JSON carries as the contract `type`.
 *
 * @param type Contract type integer (e.g. `1`).
 * @returns The name (e.g. `'TransferContract'`), or `undefined` if unregistered.
 */
export function contractTypeNameOf(type: number): ContractTypeName | undefined {
  return contractTypeNames.get(type)
}

/** `google.protobuf.Any` type URL prefix of TRON protocol messages. */
export const contractTypeUrlPrefix = 'type.googleapis.com/protocol.'

/**
 * Encoder/decoder pair for one contract message type, keyed both by the
 * `Transaction.Contract.type` integer and the `Any` type URL.
 */
export type ContractCodec<message = unknown> = {
  /** `Transaction.Contract.type` integer. */
  readonly type: number
  /** Protocol message name (e.g. `'TransferContract'`). */
  readonly name: string
  /** `google.protobuf.Any` type URL. */
  readonly typeUrl: string
  /** Encodes the message body (the `Any.value` bytes). */
  encode(message: message): ByteArray
  /** Decodes the message body (the `Any.value` bytes). */
  decode(bytes: ByteArray): message
}

/** Builds a codec entry, deriving the type URL from the message name. */
function defineContractCodec<message>(
  type: number,
  name: string,
  encode: (message: message) => ByteArray,
  decode: (bytes: ByteArray) => message,
): ContractCodec<message> {
  return {
    type,
    name,
    typeUrl: `${contractTypeUrlPrefix}${name}`,
    encode,
    decode,
  }
}

/** All registered contract codecs (v0.1 contract set). */
export const contractCodecs: readonly ContractCodec[] = [
  defineContractCodec(
    ContractType.TransferContract,
    'TransferContract',
    encodeTransferContract,
    decodeTransferContract,
  ),
  defineContractCodec(
    ContractType.TransferAssetContract,
    'TransferAssetContract',
    encodeTransferAssetContract,
    decodeTransferAssetContract,
  ),
  defineContractCodec(
    ContractType.VoteWitnessContract,
    'VoteWitnessContract',
    encodeVoteWitnessContract,
    decodeVoteWitnessContract,
  ),
  defineContractCodec(
    ContractType.FreezeBalanceContract,
    'FreezeBalanceContract',
    encodeFreezeBalanceContract,
    decodeFreezeBalanceContract,
  ),
  defineContractCodec(
    ContractType.UnfreezeBalanceContract,
    'UnfreezeBalanceContract',
    encodeUnfreezeBalanceContract,
    decodeUnfreezeBalanceContract,
  ),
  defineContractCodec(
    ContractType.AssetIssueContract,
    'AssetIssueContract',
    encodeAssetIssueContract,
    decodeAssetIssueContract,
  ),
  defineContractCodec(
    ContractType.ParticipateAssetIssueContract,
    'ParticipateAssetIssueContract',
    encodeParticipateAssetIssueContract,
    decodeParticipateAssetIssueContract,
  ),
  defineContractCodec(
    ContractType.UpdateAssetContract,
    'UpdateAssetContract',
    encodeUpdateAssetContract,
    decodeUpdateAssetContract,
  ),
  defineContractCodec(
    ContractType.WithdrawBalanceContract,
    'WithdrawBalanceContract',
    encodeWithdrawBalanceContract,
    decodeWithdrawBalanceContract,
  ),
  defineContractCodec(
    ContractType.CreateSmartContract,
    'CreateSmartContract',
    encodeCreateSmartContract,
    decodeCreateSmartContract,
  ),
  defineContractCodec(
    ContractType.TriggerSmartContract,
    'TriggerSmartContract',
    encodeTriggerSmartContract,
    decodeTriggerSmartContract,
  ),
  defineContractCodec(
    ContractType.AccountPermissionUpdateContract,
    'AccountPermissionUpdateContract',
    encodeAccountPermissionUpdateContract,
    decodeAccountPermissionUpdateContract,
  ),
  defineContractCodec(
    ContractType.FreezeBalanceV2Contract,
    'FreezeBalanceV2Contract',
    encodeFreezeBalanceV2Contract,
    decodeFreezeBalanceV2Contract,
  ),
  defineContractCodec(
    ContractType.UnfreezeBalanceV2Contract,
    'UnfreezeBalanceV2Contract',
    encodeUnfreezeBalanceV2Contract,
    decodeUnfreezeBalanceV2Contract,
  ),
  defineContractCodec(
    ContractType.WithdrawExpireUnfreezeContract,
    'WithdrawExpireUnfreezeContract',
    encodeWithdrawExpireUnfreezeContract,
    decodeWithdrawExpireUnfreezeContract,
  ),
  defineContractCodec(
    ContractType.DelegateResourceContract,
    'DelegateResourceContract',
    encodeDelegateResourceContract,
    decodeDelegateResourceContract,
  ),
  defineContractCodec(
    ContractType.UnDelegateResourceContract,
    'UnDelegateResourceContract',
    encodeUnDelegateResourceContract,
    decodeUnDelegateResourceContract,
  ),
  defineContractCodec(
    ContractType.CancelAllUnfreezeV2Contract,
    'CancelAllUnfreezeV2Contract',
    encodeCancelAllUnfreezeV2Contract,
    decodeCancelAllUnfreezeV2Contract,
  ),
  defineContractCodec(
    ContractType.UpdateBrokerageContract,
    'UpdateBrokerageContract',
    encodeUpdateBrokerageContract,
    decodeUpdateBrokerageContract,
  ),
  defineContractCodec(
    ContractType.AccountCreateContract,
    'AccountCreateContract',
    encodeAccountCreateContract,
    decodeAccountCreateContract,
  ),
  defineContractCodec(
    ContractType.AccountUpdateContract,
    'AccountUpdateContract',
    encodeAccountUpdateContract,
    decodeAccountUpdateContract,
  ),
  defineContractCodec(
    ContractType.SetAccountIdContract,
    'SetAccountIdContract',
    encodeSetAccountIdContract,
    decodeSetAccountIdContract,
  ),
  defineContractCodec(
    ContractType.WitnessCreateContract,
    'WitnessCreateContract',
    encodeWitnessCreateContract,
    decodeWitnessCreateContract,
  ),
  defineContractCodec(
    ContractType.WitnessUpdateContract,
    'WitnessUpdateContract',
    encodeWitnessUpdateContract,
    decodeWitnessUpdateContract,
  ),
  defineContractCodec(
    ContractType.ClearABIContract,
    'ClearABIContract',
    encodeClearABIContract,
    decodeClearABIContract,
  ),
  defineContractCodec(
    ContractType.UpdateSettingContract,
    'UpdateSettingContract',
    encodeUpdateSettingContract,
    decodeUpdateSettingContract,
  ),
  defineContractCodec(
    ContractType.UpdateEnergyLimitContract,
    'UpdateEnergyLimitContract',
    encodeUpdateEnergyLimitContract,
    decodeUpdateEnergyLimitContract,
  ),
  defineContractCodec(
    ContractType.ProposalCreateContract,
    'ProposalCreateContract',
    encodeProposalCreateContract,
    decodeProposalCreateContract,
  ),
  defineContractCodec(
    ContractType.ProposalApproveContract,
    'ProposalApproveContract',
    encodeProposalApproveContract,
    decodeProposalApproveContract,
  ),
  defineContractCodec(
    ContractType.ProposalDeleteContract,
    'ProposalDeleteContract',
    encodeProposalDeleteContract,
    decodeProposalDeleteContract,
  ),
  defineContractCodec(
    ContractType.ExchangeCreateContract,
    'ExchangeCreateContract',
    encodeExchangeCreateContract,
    decodeExchangeCreateContract,
  ),
  defineContractCodec(
    ContractType.ExchangeInjectContract,
    'ExchangeInjectContract',
    encodeExchangeInjectContract,
    decodeExchangeInjectContract,
  ),
  defineContractCodec(
    ContractType.ExchangeWithdrawContract,
    'ExchangeWithdrawContract',
    encodeExchangeWithdrawContract,
    decodeExchangeWithdrawContract,
  ),
  defineContractCodec(
    ContractType.ExchangeTransactionContract,
    'ExchangeTransactionContract',
    encodeExchangeTransactionContract,
    decodeExchangeTransactionContract,
  ),
]

const codecsByTypeUrl = new Map(
  contractCodecs.map((codec) => [codec.typeUrl, codec]),
)
const codecsByType = new Map(contractCodecs.map((codec) => [codec.type, codec]))

/**
 * Looks up a contract codec by its `google.protobuf.Any` type URL.
 *
 * @param typeUrl Type URL (e.g. `'type.googleapis.com/protocol.TransferContract'`).
 * @returns The codec, or `undefined` if the type URL is not registered.
 */
export function getContractCodecByTypeUrl(
  typeUrl: string,
): ContractCodec | undefined {
  return codecsByTypeUrl.get(typeUrl)
}

/**
 * Looks up a contract codec by its `Transaction.Contract.type` integer.
 *
 * @param type Contract type integer (e.g. `1` for `TransferContract`).
 * @returns The codec, or `undefined` if the type is not registered.
 */
export function getContractCodecByType(
  type: number,
): ContractCodec | undefined {
  return codecsByType.get(type)
}

/**
 * Decodes an `Any`-wrapped contract parameter. Never throws on an
 * unregistered type URL: the raw payload is returned as
 * `{ __unknown: true, type_url, value }` (bare-hex value) instead.
 *
 * @param typeUrl `Any.type_url` of the parameter.
 * @param valueBytes `Any.value` bytes of the parameter.
 * @returns The decoded contract message, or the unknown-parameter fallback.
 */
export function decodeContractParameter(
  typeUrl: string,
  valueBytes: ByteArray,
): ContractMessage | UnknownContractParameter {
  const codec = codecsByTypeUrl.get(typeUrl)
  if (!codec)
    return {
      __unknown: true,
      type_url: typeUrl,
      value: bareHex(valueBytes),
    }
  return codec.decode(valueBytes) as ContractMessage
}
