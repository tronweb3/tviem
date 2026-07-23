import type { ErrorType } from '../../../errors/utils.js'
import type { ByteArray } from '../../../types/misc.js'
import type {
  FreezeBalanceContract,
  UnfreezeBalanceContract,
} from '../types.js'
import {
  type DecodeMessageErrorType,
  decodeMessage,
  type EncodeMessageErrorType,
  encodeMessage,
  type MessageSpec,
} from './codec.js'

/** `FreezeBalanceContract` (type 11, Stake 1.0) field schema. */
const freezeBalanceContractSpec: MessageSpec = [
  { no: 1, name: 'ownerAddress', kind: 'address' },
  { no: 2, name: 'frozenBalance', kind: 'i64' },
  { no: 3, name: 'frozenDuration', kind: 'i64' },
  { no: 10, name: 'resource', kind: 'enum' },
  { no: 15, name: 'receiverAddress', kind: 'address' },
]

export type EncodeFreezeBalanceContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes a `FreezeBalanceContract` (contract type 11) body. */
export function encodeFreezeBalanceContract(
  message: FreezeBalanceContract,
): ByteArray {
  return encodeMessage(freezeBalanceContractSpec, message)
}

export type DecodeFreezeBalanceContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes a `FreezeBalanceContract` body. */
export function decodeFreezeBalanceContract(
  bytes: ByteArray,
): FreezeBalanceContract {
  return decodeMessage(
    freezeBalanceContractSpec,
    bytes,
  ) as FreezeBalanceContract
}

/** `UnfreezeBalanceContract` (type 12, Stake 1.0) field schema. */
const unfreezeBalanceContractSpec: MessageSpec = [
  { no: 1, name: 'ownerAddress', kind: 'address' },
  { no: 10, name: 'resource', kind: 'enum' },
  { no: 15, name: 'receiverAddress', kind: 'address' },
]

export type EncodeUnfreezeBalanceContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes an `UnfreezeBalanceContract` (contract type 12) body. */
export function encodeUnfreezeBalanceContract(
  message: UnfreezeBalanceContract,
): ByteArray {
  return encodeMessage(unfreezeBalanceContractSpec, message)
}

export type DecodeUnfreezeBalanceContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes an `UnfreezeBalanceContract` body. */
export function decodeUnfreezeBalanceContract(
  bytes: ByteArray,
): UnfreezeBalanceContract {
  return decodeMessage(
    unfreezeBalanceContractSpec,
    bytes,
  ) as UnfreezeBalanceContract
}
