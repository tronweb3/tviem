import type { ErrorType } from '../../../errors/utils.js'
import type { ByteArray } from '../../../types/misc.js'
import type {
  UpdateBrokerageContract,
  WitnessCreateContract,
  WitnessUpdateContract,
} from '../types.js'
import {
  type DecodeMessageErrorType,
  decodeMessage,
  type EncodeMessageErrorType,
  encodeMessage,
  type MessageSpec,
} from './codec.js'

/** `UpdateBrokerageContract` (type 49) field schema. */
const updateBrokerageContractSpec: MessageSpec = [
  { no: 1, name: 'ownerAddress', kind: 'address' },
  { no: 2, name: 'brokerage', kind: 'i32' },
]

export type EncodeUpdateBrokerageContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes an `UpdateBrokerageContract` (contract type 49) body. */
export function encodeUpdateBrokerageContract(
  message: UpdateBrokerageContract,
): ByteArray {
  return encodeMessage(updateBrokerageContractSpec, message)
}

export type DecodeUpdateBrokerageContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes an `UpdateBrokerageContract` body. */
export function decodeUpdateBrokerageContract(
  bytes: ByteArray,
): UpdateBrokerageContract {
  return decodeMessage(
    updateBrokerageContractSpec,
    bytes,
  ) as UpdateBrokerageContract
}

/** `WitnessCreateContract` (type 5) field schema. */
const witnessCreateContractSpec: MessageSpec = [
  { no: 1, name: 'ownerAddress', kind: 'address' },
  { no: 2, name: 'url', kind: 'flex' },
]

export type EncodeWitnessCreateContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes a `WitnessCreateContract` (contract type 5) body. */
export function encodeWitnessCreateContract(
  message: WitnessCreateContract,
): ByteArray {
  return encodeMessage(witnessCreateContractSpec, message)
}

export type DecodeWitnessCreateContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes a `WitnessCreateContract` body. */
export function decodeWitnessCreateContract(
  bytes: ByteArray,
): WitnessCreateContract {
  return decodeMessage(
    witnessCreateContractSpec,
    bytes,
  ) as WitnessCreateContract
}

/** `WitnessUpdateContract` (type 8) field schema. */
const witnessUpdateContractSpec: MessageSpec = [
  { no: 1, name: 'ownerAddress', kind: 'address' },
  { no: 12, name: 'updateUrl', kind: 'flex' },
]

export type EncodeWitnessUpdateContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes a `WitnessUpdateContract` (contract type 8) body. */
export function encodeWitnessUpdateContract(
  message: WitnessUpdateContract,
): ByteArray {
  return encodeMessage(witnessUpdateContractSpec, message)
}

export type DecodeWitnessUpdateContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes a `WitnessUpdateContract` body. */
export function decodeWitnessUpdateContract(
  bytes: ByteArray,
): WitnessUpdateContract {
  return decodeMessage(
    witnessUpdateContractSpec,
    bytes,
  ) as WitnessUpdateContract
}
