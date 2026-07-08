import type { ErrorType } from '../../../errors/utils.js'
import type { ByteArray } from '../../../types/misc.js'
import type { AccountPermissionUpdateContract } from '../types.js'
import {
  type DecodeMessageErrorType,
  decodeMessage,
  type EncodeMessageErrorType,
  encodeMessage,
  type MessageSpec,
} from './codec.js'

/** `Permission.Key` field schema. */
const permissionKeySpec: MessageSpec = [
  { no: 1, name: 'address', kind: 'address' },
  { no: 2, name: 'weight', kind: 'i64' },
]

/**
 * `Permission` field schema. `operations` (field 6) is a 32-byte bitmap of
 * allowed contract types.
 */
const permissionSpec: MessageSpec = [
  { no: 1, name: 'type', kind: 'enum' },
  { no: 2, name: 'id', kind: 'i32' },
  { no: 3, name: 'permissionName', kind: 'string' },
  { no: 4, name: 'threshold', kind: 'i64' },
  { no: 5, name: 'parentId', kind: 'i32' },
  { no: 6, name: 'operations', kind: 'bytes' },
  { no: 7, name: 'keys', kind: 'repeated-message', spec: permissionKeySpec },
]

/** `AccountPermissionUpdateContract` (type 46) field schema. */
const accountPermissionUpdateContractSpec: MessageSpec = [
  { no: 1, name: 'ownerAddress', kind: 'address' },
  { no: 2, name: 'owner', kind: 'message', spec: permissionSpec },
  { no: 3, name: 'witness', kind: 'message', spec: permissionSpec },
  { no: 4, name: 'actives', kind: 'repeated-message', spec: permissionSpec },
]

export type EncodeAccountPermissionUpdateContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes an `AccountPermissionUpdateContract` (contract type 46) body. */
export function encodeAccountPermissionUpdateContract(
  message: AccountPermissionUpdateContract,
): ByteArray {
  return encodeMessage(accountPermissionUpdateContractSpec, message)
}

export type DecodeAccountPermissionUpdateContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes an `AccountPermissionUpdateContract` body. */
export function decodeAccountPermissionUpdateContract(
  bytes: ByteArray,
): AccountPermissionUpdateContract {
  return decodeMessage(
    accountPermissionUpdateContractSpec,
    bytes,
  ) as AccountPermissionUpdateContract
}
