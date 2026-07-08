import type { ErrorType } from '../../../errors/utils.js'
import type { ByteArray } from '../../../types/misc.js'
import type { CreateSmartContract, TriggerSmartContract } from '../types.js'
import {
  type DecodeMessageErrorType,
  decodeMessage,
  type EncodeMessageErrorType,
  encodeMessage,
  type MessageSpec,
} from './codec.js'

/** `SmartContract.ABI.Entry.Param` field schema. */
const smartContractAbiParamSpec: MessageSpec = [
  { no: 1, name: 'indexed', kind: 'bool' },
  { no: 2, name: 'name', kind: 'string' },
  { no: 3, name: 'type', kind: 'string' },
]

/** `SmartContract.ABI.Entry` field schema. */
const smartContractAbiEntrySpec: MessageSpec = [
  { no: 1, name: 'anonymous', kind: 'bool' },
  { no: 2, name: 'constant', kind: 'bool' },
  { no: 3, name: 'name', kind: 'string' },
  {
    no: 4,
    name: 'inputs',
    kind: 'repeated-message',
    spec: smartContractAbiParamSpec,
  },
  {
    no: 5,
    name: 'outputs',
    kind: 'repeated-message',
    spec: smartContractAbiParamSpec,
  },
  { no: 6, name: 'type', kind: 'enum' },
  { no: 7, name: 'payable', kind: 'bool' },
  { no: 8, name: 'stateMutability', kind: 'enum' },
]

/** `SmartContract.ABI` field schema. */
const smartContractAbiSpec: MessageSpec = [
  {
    no: 1,
    name: 'entrys',
    kind: 'repeated-message',
    spec: smartContractAbiEntrySpec,
  },
]

/**
 * `SmartContract` field schema (nested in `CreateSmartContract`). The
 * deployment `call_value` lives here (field 5), not on the outer
 * `CreateSmartContract` message.
 */
const smartContractSpec: MessageSpec = [
  { no: 1, name: 'originAddress', kind: 'address' },
  { no: 2, name: 'contractAddress', kind: 'address' },
  { no: 3, name: 'abi', kind: 'message', spec: smartContractAbiSpec },
  { no: 4, name: 'bytecode', kind: 'bytes' },
  { no: 5, name: 'callValue', kind: 'i64' },
  { no: 6, name: 'consumeUserResourcePercent', kind: 'i64' },
  { no: 7, name: 'name', kind: 'string' },
  { no: 8, name: 'originEnergyLimit', kind: 'i64' },
  { no: 9, name: 'codeHash', kind: 'bytes' },
  { no: 10, name: 'trxHash', kind: 'bytes' },
  { no: 11, name: 'version', kind: 'i32' },
]

/** `CreateSmartContract` (type 30) field schema. */
const createSmartContractSpec: MessageSpec = [
  { no: 1, name: 'ownerAddress', kind: 'address' },
  { no: 2, name: 'newContract', kind: 'message', spec: smartContractSpec },
  { no: 3, name: 'callTokenValue', kind: 'i64' },
  { no: 4, name: 'tokenId', kind: 'i64' },
]

export type EncodeCreateSmartContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes a `CreateSmartContract` (contract type 30) body. */
export function encodeCreateSmartContract(
  message: CreateSmartContract,
): ByteArray {
  return encodeMessage(createSmartContractSpec, message)
}

export type DecodeCreateSmartContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes a `CreateSmartContract` body. */
export function decodeCreateSmartContract(
  bytes: ByteArray,
): CreateSmartContract {
  return decodeMessage(createSmartContractSpec, bytes) as CreateSmartContract
}

/** `TriggerSmartContract` (type 31) field schema. */
const triggerSmartContractSpec: MessageSpec = [
  { no: 1, name: 'ownerAddress', kind: 'address' },
  { no: 2, name: 'contractAddress', kind: 'address' },
  { no: 3, name: 'callValue', kind: 'i64' },
  { no: 4, name: 'data', kind: 'bytes' },
  { no: 5, name: 'callTokenValue', kind: 'i64' },
  { no: 6, name: 'tokenId', kind: 'i64' },
]

export type EncodeTriggerSmartContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes a `TriggerSmartContract` (contract type 31) body. */
export function encodeTriggerSmartContract(
  message: TriggerSmartContract,
): ByteArray {
  return encodeMessage(triggerSmartContractSpec, message)
}

export type DecodeTriggerSmartContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes a `TriggerSmartContract` body. */
export function decodeTriggerSmartContract(
  bytes: ByteArray,
): TriggerSmartContract {
  return decodeMessage(triggerSmartContractSpec, bytes) as TriggerSmartContract
}
