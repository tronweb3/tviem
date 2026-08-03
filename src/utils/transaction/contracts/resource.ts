import type { ErrorType } from '../../../errors/utils.js'
import type { ByteArray } from '../../../types/misc.js'
import type {
  DelegateResourceContract,
  UnDelegateResourceContract,
} from '../types.js'
import { ResourceCodeName } from '../types.js'
import {
  type DecodeMessageErrorType,
  decodeMessage,
  type EncodeMessageErrorType,
  encodeMessage,
  type MessageSpec,
} from './codec.js'

/**
 * `DelegateResourceContract` (type 57) field schema.
 *
 * Field order is `owner(1) · resource(2) · balance(3) · receiver(4) ·
 * lock(5) · lock_period(6)` — note `resource` and `balance` come *before*
 * `receiver_address`.
 */
const delegateResourceContractSpec: MessageSpec = [
  { no: 1, name: 'owner_address', kind: 'address' },
  { no: 2, name: 'resource', kind: 'enum', names: ResourceCodeName },
  { no: 3, name: 'balance', kind: 'i64' },
  { no: 4, name: 'receiver_address', kind: 'address' },
  { no: 5, name: 'lock', kind: 'bool' },
  { no: 6, name: 'lock_period', kind: 'i64' },
]

export type EncodeDelegateResourceContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes a `DelegateResourceContract` (contract type 57) body. */
export function encodeDelegateResourceContract(
  message: DelegateResourceContract,
): ByteArray {
  return encodeMessage(delegateResourceContractSpec, message)
}

export type DecodeDelegateResourceContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes a `DelegateResourceContract` body. */
export function decodeDelegateResourceContract(
  bytes: ByteArray,
): DelegateResourceContract {
  return decodeMessage(
    delegateResourceContractSpec,
    bytes,
  ) as DelegateResourceContract
}

/** `UnDelegateResourceContract` (type 58) field schema — same order. */
const unDelegateResourceContractSpec: MessageSpec = [
  { no: 1, name: 'owner_address', kind: 'address' },
  { no: 2, name: 'resource', kind: 'enum', names: ResourceCodeName },
  { no: 3, name: 'balance', kind: 'i64' },
  { no: 4, name: 'receiver_address', kind: 'address' },
]

export type EncodeUnDelegateResourceContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes an `UnDelegateResourceContract` (contract type 58) body. */
export function encodeUnDelegateResourceContract(
  message: UnDelegateResourceContract,
): ByteArray {
  return encodeMessage(unDelegateResourceContractSpec, message)
}

export type DecodeUnDelegateResourceContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes an `UnDelegateResourceContract` body. */
export function decodeUnDelegateResourceContract(
  bytes: ByteArray,
): UnDelegateResourceContract {
  return decodeMessage(
    unDelegateResourceContractSpec,
    bytes,
  ) as UnDelegateResourceContract
}
