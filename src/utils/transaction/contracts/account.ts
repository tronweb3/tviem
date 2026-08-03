import type { ErrorType } from '../../../errors/utils.js'
import type { ByteArray } from '../../../types/misc.js'
import type {
  AccountCreateContract,
  AccountUpdateContract,
  SetAccountIdContract,
} from '../types.js'
import { AccountTypeName } from '../types.js'
import {
  type DecodeMessageErrorType,
  decodeMessage,
  type EncodeMessageErrorType,
  encodeMessage,
  type MessageSpec,
} from './codec.js'

/** `AccountCreateContract` (type 0) field schema. */
const accountCreateContractSpec: MessageSpec = [
  { no: 1, name: 'owner_address', kind: 'address' },
  { no: 2, name: 'account_address', kind: 'address' },
  { no: 3, name: 'type', kind: 'enum', names: AccountTypeName },
]

export type EncodeAccountCreateContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes an `AccountCreateContract` (contract type 0) body. */
export function encodeAccountCreateContract(
  message: AccountCreateContract,
): ByteArray {
  return encodeMessage(accountCreateContractSpec, message)
}

export type DecodeAccountCreateContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes an `AccountCreateContract` body. */
export function decodeAccountCreateContract(
  bytes: ByteArray,
): AccountCreateContract {
  return decodeMessage(
    accountCreateContractSpec,
    bytes,
  ) as AccountCreateContract
}

/** `AccountUpdateContract` (type 10) field schema. */
const accountUpdateContractSpec: MessageSpec = [
  { no: 1, name: 'account_name', kind: 'bytes' },
  { no: 2, name: 'owner_address', kind: 'address' },
]

export type EncodeAccountUpdateContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes an `AccountUpdateContract` (contract type 10) body. */
export function encodeAccountUpdateContract(
  message: AccountUpdateContract,
): ByteArray {
  return encodeMessage(accountUpdateContractSpec, message)
}

export type DecodeAccountUpdateContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes an `AccountUpdateContract` body. */
export function decodeAccountUpdateContract(
  bytes: ByteArray,
): AccountUpdateContract {
  return decodeMessage(
    accountUpdateContractSpec,
    bytes,
  ) as AccountUpdateContract
}

/** `SetAccountIdContract` (type 19) field schema. */
const setAccountIdContractSpec: MessageSpec = [
  { no: 1, name: 'account_id', kind: 'bytes' },
  { no: 2, name: 'owner_address', kind: 'address' },
]

export type EncodeSetAccountIdContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes a `SetAccountIdContract` (contract type 19) body. */
export function encodeSetAccountIdContract(
  message: SetAccountIdContract,
): ByteArray {
  return encodeMessage(setAccountIdContractSpec, message)
}

export type DecodeSetAccountIdContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes a `SetAccountIdContract` body. */
export function decodeSetAccountIdContract(
  bytes: ByteArray,
): SetAccountIdContract {
  return decodeMessage(setAccountIdContractSpec, bytes) as SetAccountIdContract
}
