import type { ErrorType } from '../../../errors/utils.js'
import type { ByteArray } from '../../../types/misc.js'
import type {
  AssetIssueContract,
  ParticipateAssetIssueContract,
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
  { no: 1, name: 'ownerAddress', kind: 'address' },
  { no: 2, name: 'toAddress', kind: 'address' },
  { no: 3, name: 'assetName', kind: 'flex' },
  { no: 4, name: 'amount', kind: 'i64' },
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
  { no: 1, name: 'frozenAmount', kind: 'i64' },
  { no: 2, name: 'frozenDays', kind: 'i64' },
]

/** `AssetIssueContract` (type 6) field schema. */
const assetIssueContractSpec: MessageSpec = [
  { no: 1, name: 'ownerAddress', kind: 'address' },
  { no: 2, name: 'name', kind: 'flex' },
  { no: 3, name: 'abbr', kind: 'flex' },
  { no: 4, name: 'totalSupply', kind: 'i64' },
  {
    no: 5,
    name: 'frozenSupply',
    kind: 'repeated-message',
    spec: frozenSupplySpec,
  },
  { no: 6, name: 'trxNum', kind: 'i32' },
  { no: 7, name: 'precision', kind: 'i32' },
  { no: 8, name: 'num', kind: 'i32' },
  { no: 9, name: 'startTime', kind: 'i64' },
  { no: 10, name: 'endTime', kind: 'i64' },
  { no: 16, name: 'voteScore', kind: 'i32' },
  { no: 20, name: 'description', kind: 'flex' },
  { no: 21, name: 'url', kind: 'flex' },
  { no: 22, name: 'freeAssetNetLimit', kind: 'i64' },
  { no: 23, name: 'publicFreeAssetNetLimit', kind: 'i64' },
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
  { no: 1, name: 'ownerAddress', kind: 'address' },
  { no: 2, name: 'description', kind: 'flex' },
  { no: 3, name: 'url', kind: 'flex' },
  { no: 4, name: 'newLimit', kind: 'i64' },
  { no: 5, name: 'newPublicLimit', kind: 'i64' },
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
