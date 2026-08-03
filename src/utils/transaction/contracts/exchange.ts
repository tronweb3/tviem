import type { ErrorType } from '../../../errors/utils.js'
import type { ByteArray } from '../../../types/misc.js'
import type {
  ExchangeCreateContract,
  ExchangeInjectContract,
  ExchangeTransactionContract,
  ExchangeWithdrawContract,
} from '../types.js'
import {
  type DecodeMessageErrorType,
  decodeMessage,
  type EncodeMessageErrorType,
  encodeMessage,
  type MessageSpec,
} from './codec.js'

/** `ExchangeCreateContract` (type 41) field schema. */
const exchangeCreateContractSpec: MessageSpec = [
  { no: 1, name: 'owner_address', kind: 'address' },
  { no: 2, name: 'first_token_id', kind: 'bytes' },
  { no: 3, name: 'first_token_balance', kind: 'i64' },
  { no: 4, name: 'second_token_id', kind: 'bytes' },
  { no: 5, name: 'second_token_balance', kind: 'i64' },
]

export type EncodeExchangeCreateContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes an `ExchangeCreateContract` (contract type 41) body. */
export function encodeExchangeCreateContract(
  message: ExchangeCreateContract,
): ByteArray {
  return encodeMessage(exchangeCreateContractSpec, message)
}

export type DecodeExchangeCreateContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes an `ExchangeCreateContract` body. */
export function decodeExchangeCreateContract(
  bytes: ByteArray,
): ExchangeCreateContract {
  return decodeMessage(
    exchangeCreateContractSpec,
    bytes,
  ) as ExchangeCreateContract
}

/** `ExchangeInjectContract` (type 42) field schema. */
const exchangeInjectContractSpec: MessageSpec = [
  { no: 1, name: 'owner_address', kind: 'address' },
  { no: 2, name: 'exchange_id', kind: 'i64' },
  { no: 3, name: 'token_id', kind: 'bytes' },
  { no: 4, name: 'quant', kind: 'i64' },
]

export type EncodeExchangeInjectContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes an `ExchangeInjectContract` (contract type 42) body. */
export function encodeExchangeInjectContract(
  message: ExchangeInjectContract,
): ByteArray {
  return encodeMessage(exchangeInjectContractSpec, message)
}

export type DecodeExchangeInjectContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes an `ExchangeInjectContract` body. */
export function decodeExchangeInjectContract(
  bytes: ByteArray,
): ExchangeInjectContract {
  return decodeMessage(
    exchangeInjectContractSpec,
    bytes,
  ) as ExchangeInjectContract
}

/** `ExchangeWithdrawContract` (type 43) field schema. */
const exchangeWithdrawContractSpec: MessageSpec = [
  { no: 1, name: 'owner_address', kind: 'address' },
  { no: 2, name: 'exchange_id', kind: 'i64' },
  { no: 3, name: 'token_id', kind: 'bytes' },
  { no: 4, name: 'quant', kind: 'i64' },
]

export type EncodeExchangeWithdrawContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes an `ExchangeWithdrawContract` (contract type 43) body. */
export function encodeExchangeWithdrawContract(
  message: ExchangeWithdrawContract,
): ByteArray {
  return encodeMessage(exchangeWithdrawContractSpec, message)
}

export type DecodeExchangeWithdrawContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes an `ExchangeWithdrawContract` body. */
export function decodeExchangeWithdrawContract(
  bytes: ByteArray,
): ExchangeWithdrawContract {
  return decodeMessage(
    exchangeWithdrawContractSpec,
    bytes,
  ) as ExchangeWithdrawContract
}

/** `ExchangeTransactionContract` (type 44) field schema. */
const exchangeTransactionContractSpec: MessageSpec = [
  { no: 1, name: 'owner_address', kind: 'address' },
  { no: 2, name: 'exchange_id', kind: 'i64' },
  { no: 3, name: 'token_id', kind: 'bytes' },
  { no: 4, name: 'quant', kind: 'i64' },
  { no: 5, name: 'expected', kind: 'i64' },
]

export type EncodeExchangeTransactionContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes an `ExchangeTransactionContract` (contract type 44) body. */
export function encodeExchangeTransactionContract(
  message: ExchangeTransactionContract,
): ByteArray {
  return encodeMessage(exchangeTransactionContractSpec, message)
}

export type DecodeExchangeTransactionContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes an `ExchangeTransactionContract` body. */
export function decodeExchangeTransactionContract(
  bytes: ByteArray,
): ExchangeTransactionContract {
  return decodeMessage(
    exchangeTransactionContractSpec,
    bytes,
  ) as ExchangeTransactionContract
}
