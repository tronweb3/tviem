import type { ErrorType } from '../../../errors/utils.js'
import type { ByteArray } from '../../../types/misc.js'
import type {
  AssetIssueContract,
  ParticipateAssetIssueContract,
  UnfreezeAssetContract,
  UpdateAssetContract,
} from '../types.js'
import {
  type DecodeMessageErrorType,
  decodeMessage,
  type EncodeMessageErrorType,
  encodeMessage,
  type MessageSpec,
} from './codec.js'

/** `ParticipateAssetIssueContract` (type 9) field schema. */
const participateAssetIssueContractSpec: MessageSpec = [
  { no: 1, name: 'owner_address', kind: 'address', required: true },
  { no: 2, name: 'to_address', kind: 'address', required: true },
  { no: 3, name: 'asset_name', kind: 'bytes', required: true },
  { no: 4, name: 'amount', kind: 'i64', required: true },
]

export type EncodeParticipateAssetIssueContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes a `ParticipateAssetIssueContract` (contract type 9) body. */
export function encodeParticipateAssetIssueContract(
  message: ParticipateAssetIssueContract,
): ByteArray {
  return encodeMessage(participateAssetIssueContractSpec, message)
}

export type DecodeParticipateAssetIssueContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes a `ParticipateAssetIssueContract` body. */
export function decodeParticipateAssetIssueContract(
  bytes: ByteArray,
): ParticipateAssetIssueContract {
  return decodeMessage(
    participateAssetIssueContractSpec,
    bytes,
  ) as ParticipateAssetIssueContract
}

/** `AssetIssueContract.FrozenSupply` field schema. */
const frozenSupplySpec: MessageSpec = [
  { no: 1, name: 'frozen_amount', kind: 'i64', required: true },
  { no: 2, name: 'frozen_days', kind: 'i64', required: true },
]

/** `AssetIssueContract` (type 6) field schema. */
const assetIssueContractSpec: MessageSpec = [
  { no: 1, name: 'owner_address', kind: 'address', required: true },
  { no: 2, name: 'name', kind: 'bytes', required: true },
  { no: 3, name: 'abbr', kind: 'bytes', required: true },
  { no: 4, name: 'total_supply', kind: 'i64', required: true },
  {
    no: 5,
    name: 'frozen_supply',
    kind: 'repeated-message',
    spec: frozenSupplySpec,
  },
  { no: 6, name: 'trx_num', kind: 'i32', required: true },
  { no: 7, name: 'precision', kind: 'i32' },
  { no: 8, name: 'num', kind: 'i32', required: true },
  { no: 9, name: 'start_time', kind: 'i64', required: true },
  { no: 10, name: 'end_time', kind: 'i64', required: true },
  { no: 11, name: 'order', kind: 'i64' },
  { no: 16, name: 'vote_score', kind: 'i32' },
  // description is deliberately not required: the chain accepts an empty
  // description (absent from the wire), and gold fixtures carry such cases.
  { no: 20, name: 'description', kind: 'bytes' },
  { no: 21, name: 'url', kind: 'bytes', required: true },
  { no: 22, name: 'free_asset_net_limit', kind: 'i64' },
  { no: 23, name: 'public_free_asset_net_limit', kind: 'i64' },
  { no: 24, name: 'public_free_asset_net_usage', kind: 'i64' },
  { no: 25, name: 'public_latest_free_net_time', kind: 'i64' },
  { no: 41, name: 'id', kind: 'string' },
]

export type EncodeAssetIssueContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes an `AssetIssueContract` (contract type 6) body. */
export function encodeAssetIssueContract(
  message: AssetIssueContract,
): ByteArray {
  return encodeMessage(assetIssueContractSpec, message)
}

export type DecodeAssetIssueContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes an `AssetIssueContract` body. */
export function decodeAssetIssueContract(bytes: ByteArray): AssetIssueContract {
  return decodeMessage(assetIssueContractSpec, bytes) as AssetIssueContract
}

/** `UpdateAssetContract` (type 15) field schema. */
const updateAssetContractSpec: MessageSpec = [
  { no: 1, name: 'owner_address', kind: 'address', required: true },
  { no: 2, name: 'description', kind: 'bytes' },
  { no: 3, name: 'url', kind: 'bytes' },
  { no: 4, name: 'new_limit', kind: 'i64' },
  { no: 5, name: 'new_public_limit', kind: 'i64' },
]

export type EncodeUpdateAssetContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes an `UpdateAssetContract` (contract type 15) body. */
export function encodeUpdateAssetContract(
  message: UpdateAssetContract,
): ByteArray {
  return encodeMessage(updateAssetContractSpec, message)
}

export type DecodeUpdateAssetContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes an `UpdateAssetContract` body. */
export function decodeUpdateAssetContract(
  bytes: ByteArray,
): UpdateAssetContract {
  return decodeMessage(updateAssetContractSpec, bytes) as UpdateAssetContract
}

/** `UnfreezeAssetContract` (type 14) field schema. */
const unfreezeAssetContractSpec: MessageSpec = [
  { no: 1, name: 'owner_address', kind: 'address', required: true },
]

export type EncodeUnfreezeAssetContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes an `UnfreezeAssetContract` (contract type 14) body. */
export function encodeUnfreezeAssetContract(
  message: UnfreezeAssetContract,
): ByteArray {
  return encodeMessage(unfreezeAssetContractSpec, message)
}

export type DecodeUnfreezeAssetContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes an `UnfreezeAssetContract` body. */
export function decodeUnfreezeAssetContract(
  bytes: ByteArray,
): UnfreezeAssetContract {
  return decodeMessage(
    unfreezeAssetContractSpec,
    bytes,
  ) as UnfreezeAssetContract
}
