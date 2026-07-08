import type { ByteArray } from '../../types/misc.js'
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
  decodeAccountPermissionUpdateContract,
  encodeAccountPermissionUpdateContract,
} from './contracts/permission.js'
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
  decodeTransferAssetContract,
  decodeTransferContract,
  encodeTransferAssetContract,
  encodeTransferContract,
} from './contracts/transfer.js'
import {
  decodeVoteWitnessContract,
  encodeVoteWitnessContract,
} from './contracts/vote.js'
import type { ContractMessage, UnknownContractParameter } from './types.js'

/** `Transaction.Contract.ContractType` integers (v0.1 contract set). */
export const ContractType = {
  TransferContract: 1,
  TransferAssetContract: 2,
  VoteWitnessContract: 4,
  WithdrawBalanceContract: 13,
  CreateSmartContract: 30,
  TriggerSmartContract: 31,
  AccountPermissionUpdateContract: 46,
  FreezeBalanceV2Contract: 54,
  UnfreezeBalanceV2Contract: 55,
  WithdrawExpireUnfreezeContract: 56,
  DelegateResourceContract: 57,
  UnDelegateResourceContract: 58,
  CancelAllUnfreezeV2Contract: 59,
} as const
export type ContractType = (typeof ContractType)[keyof typeof ContractType]

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
 * `{ __unknown: true, typeUrl, valueBytes }` instead.
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
    return { __unknown: true, typeUrl, valueBytes: Uint8Array.from(valueBytes) }
  return codec.decode(valueBytes) as ContractMessage
}
