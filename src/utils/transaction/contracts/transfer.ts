import type { ErrorType } from '../../../errors/utils.js'
import type { ByteArray } from '../../../types/misc.js'
import type { TransferAssetContract, TransferContract } from '../types.js'
import {
  type DecodeMessageErrorType,
  decodeMessage,
  type EncodeMessageErrorType,
  encodeMessage,
  type MessageSpec,
} from './codec.js'

/** `TransferContract` (type 1) field schema. */
const transferContractSpec: MessageSpec = [
  { no: 1, name: 'owner_address', kind: 'address', required: true },
  { no: 2, name: 'to_address', kind: 'address', required: true },
  { no: 3, name: 'amount', kind: 'i64', required: true },
]

export type EncodeTransferContractErrorType = EncodeMessageErrorType | ErrorType

/** Encodes a `TransferContract` (TRX transfer, contract type 1) body. */
export function encodeTransferContract(message: TransferContract): ByteArray {
  return encodeMessage(transferContractSpec, message)
}

export type DecodeTransferContractErrorType = DecodeMessageErrorType | ErrorType

/** Decodes a `TransferContract` body. */
export function decodeTransferContract(bytes: ByteArray): TransferContract {
  return decodeMessage(transferContractSpec, bytes) as TransferContract
}

/** `TransferAssetContract` (type 2) field schema — `asset_name` is field 1. */
const transferAssetContractSpec: MessageSpec = [
  { no: 1, name: 'asset_name', kind: 'bytes', required: true },
  { no: 2, name: 'owner_address', kind: 'address', required: true },
  { no: 3, name: 'to_address', kind: 'address', required: true },
  { no: 4, name: 'amount', kind: 'i64', required: true },
]

export type EncodeTransferAssetContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes a `TransferAssetContract` (TRC10 transfer, contract type 2) body. */
export function encodeTransferAssetContract(
  message: TransferAssetContract,
): ByteArray {
  return encodeMessage(transferAssetContractSpec, message)
}

export type DecodeTransferAssetContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes a `TransferAssetContract` body. */
export function decodeTransferAssetContract(
  bytes: ByteArray,
): TransferAssetContract {
  return decodeMessage(
    transferAssetContractSpec,
    bytes,
  ) as TransferAssetContract
}
