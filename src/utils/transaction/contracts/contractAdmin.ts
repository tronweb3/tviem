import type { ErrorType } from '../../../errors/utils.js'
import type { ByteArray } from '../../../types/misc.js'
import type {
  ClearABIContract,
  UpdateEnergyLimitContract,
  UpdateSettingContract,
} from '../types.js'
import {
  type DecodeMessageErrorType,
  decodeMessage,
  type EncodeMessageErrorType,
  encodeMessage,
  type MessageSpec,
} from './codec.js'

/** `ClearABIContract` (type 48) field schema. */
const clearABIContractSpec: MessageSpec = [
  { no: 1, name: 'ownerAddress', kind: 'address' },
  { no: 2, name: 'contractAddress', kind: 'address' },
]

export type EncodeClearABIContractErrorType = EncodeMessageErrorType | ErrorType

/** Encodes a `ClearABIContract` (contract type 48) body. */
export function encodeClearABIContract(message: ClearABIContract): ByteArray {
  return encodeMessage(clearABIContractSpec, message)
}

export type DecodeClearABIContractErrorType = DecodeMessageErrorType | ErrorType

/** Decodes a `ClearABIContract` body. */
export function decodeClearABIContract(bytes: ByteArray): ClearABIContract {
  return decodeMessage(clearABIContractSpec, bytes) as ClearABIContract
}

/** `UpdateSettingContract` (type 33) field schema. */
const updateSettingContractSpec: MessageSpec = [
  { no: 1, name: 'ownerAddress', kind: 'address' },
  { no: 2, name: 'contractAddress', kind: 'address' },
  { no: 3, name: 'consumeUserResourcePercent', kind: 'i64' },
]

export type EncodeUpdateSettingContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes an `UpdateSettingContract` (contract type 33) body. */
export function encodeUpdateSettingContract(
  message: UpdateSettingContract,
): ByteArray {
  return encodeMessage(updateSettingContractSpec, message)
}

export type DecodeUpdateSettingContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes an `UpdateSettingContract` body. */
export function decodeUpdateSettingContract(
  bytes: ByteArray,
): UpdateSettingContract {
  return decodeMessage(
    updateSettingContractSpec,
    bytes,
  ) as UpdateSettingContract
}

/** `UpdateEnergyLimitContract` (type 45) field schema. */
const updateEnergyLimitContractSpec: MessageSpec = [
  { no: 1, name: 'ownerAddress', kind: 'address' },
  { no: 2, name: 'contractAddress', kind: 'address' },
  { no: 3, name: 'originEnergyLimit', kind: 'i64' },
]

export type EncodeUpdateEnergyLimitContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes an `UpdateEnergyLimitContract` (contract type 45) body. */
export function encodeUpdateEnergyLimitContract(
  message: UpdateEnergyLimitContract,
): ByteArray {
  return encodeMessage(updateEnergyLimitContractSpec, message)
}

export type DecodeUpdateEnergyLimitContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes an `UpdateEnergyLimitContract` body. */
export function decodeUpdateEnergyLimitContract(
  bytes: ByteArray,
): UpdateEnergyLimitContract {
  return decodeMessage(
    updateEnergyLimitContractSpec,
    bytes,
  ) as UpdateEnergyLimitContract
}
