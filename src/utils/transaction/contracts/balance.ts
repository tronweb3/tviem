import type { ErrorType } from '../../../errors/utils.js'
import type { ByteArray } from '../../../types/misc.js'
import type {
  CancelAllUnfreezeV2Contract,
  FreezeBalanceV2Contract,
  UnfreezeBalanceV2Contract,
  WithdrawBalanceContract,
  WithdrawExpireUnfreezeContract,
} from '../types.js'
import { ResourceCodeName } from '../types.js'
import {
  type DecodeMessageErrorType,
  decodeMessage,
  type EncodeMessageErrorType,
  encodeMessage,
  type MessageSpec,
} from './codec.js'

/** Shared schema of the owner-only contract messages. */
const ownerOnlySpec: MessageSpec = [
  { no: 1, name: 'owner_address', kind: 'address' },
]

export type EncodeWithdrawBalanceContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes a `WithdrawBalanceContract` (contract type 13) body. */
export function encodeWithdrawBalanceContract(
  message: WithdrawBalanceContract,
): ByteArray {
  return encodeMessage(ownerOnlySpec, message)
}

export type DecodeWithdrawBalanceContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes a `WithdrawBalanceContract` body. */
export function decodeWithdrawBalanceContract(
  bytes: ByteArray,
): WithdrawBalanceContract {
  return decodeMessage(ownerOnlySpec, bytes) as WithdrawBalanceContract
}

/** `FreezeBalanceV2Contract` (type 54) field schema. */
const freezeBalanceV2ContractSpec: MessageSpec = [
  { no: 1, name: 'owner_address', kind: 'address' },
  { no: 2, name: 'frozen_balance', kind: 'i64' },
  { no: 3, name: 'resource', kind: 'enum', names: ResourceCodeName },
]

export type EncodeFreezeBalanceV2ContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes a `FreezeBalanceV2Contract` (contract type 54) body. */
export function encodeFreezeBalanceV2Contract(
  message: FreezeBalanceV2Contract,
): ByteArray {
  return encodeMessage(freezeBalanceV2ContractSpec, message)
}

export type DecodeFreezeBalanceV2ContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes a `FreezeBalanceV2Contract` body. */
export function decodeFreezeBalanceV2Contract(
  bytes: ByteArray,
): FreezeBalanceV2Contract {
  return decodeMessage(
    freezeBalanceV2ContractSpec,
    bytes,
  ) as FreezeBalanceV2Contract
}

/** `UnfreezeBalanceV2Contract` (type 55) field schema. */
const unfreezeBalanceV2ContractSpec: MessageSpec = [
  { no: 1, name: 'owner_address', kind: 'address' },
  { no: 2, name: 'unfreeze_balance', kind: 'i64' },
  { no: 3, name: 'resource', kind: 'enum', names: ResourceCodeName },
]

export type EncodeUnfreezeBalanceV2ContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes an `UnfreezeBalanceV2Contract` (contract type 55) body. */
export function encodeUnfreezeBalanceV2Contract(
  message: UnfreezeBalanceV2Contract,
): ByteArray {
  return encodeMessage(unfreezeBalanceV2ContractSpec, message)
}

export type DecodeUnfreezeBalanceV2ContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes an `UnfreezeBalanceV2Contract` body. */
export function decodeUnfreezeBalanceV2Contract(
  bytes: ByteArray,
): UnfreezeBalanceV2Contract {
  return decodeMessage(
    unfreezeBalanceV2ContractSpec,
    bytes,
  ) as UnfreezeBalanceV2Contract
}

export type EncodeWithdrawExpireUnfreezeContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes a `WithdrawExpireUnfreezeContract` (contract type 56) body. */
export function encodeWithdrawExpireUnfreezeContract(
  message: WithdrawExpireUnfreezeContract,
): ByteArray {
  return encodeMessage(ownerOnlySpec, message)
}

export type DecodeWithdrawExpireUnfreezeContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes a `WithdrawExpireUnfreezeContract` body. */
export function decodeWithdrawExpireUnfreezeContract(
  bytes: ByteArray,
): WithdrawExpireUnfreezeContract {
  return decodeMessage(ownerOnlySpec, bytes) as WithdrawExpireUnfreezeContract
}

export type EncodeCancelAllUnfreezeV2ContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes a `CancelAllUnfreezeV2Contract` (contract type 59) body. */
export function encodeCancelAllUnfreezeV2Contract(
  message: CancelAllUnfreezeV2Contract,
): ByteArray {
  return encodeMessage(ownerOnlySpec, message)
}

export type DecodeCancelAllUnfreezeV2ContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes a `CancelAllUnfreezeV2Contract` body. */
export function decodeCancelAllUnfreezeV2Contract(
  bytes: ByteArray,
): CancelAllUnfreezeV2Contract {
  return decodeMessage(ownerOnlySpec, bytes) as CancelAllUnfreezeV2Contract
}
