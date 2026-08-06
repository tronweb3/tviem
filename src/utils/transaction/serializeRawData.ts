import { BaseError, type BaseErrorType } from '../../errors/base.js'
import {
  UnknownContractTypeError,
  type UnknownContractTypeErrorType,
} from '../../errors/transaction.js'
import type { ErrorType } from '../../errors/utils.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import { concatBytes } from '../data/concat.js'
import { bareHex } from '../encoding/bareHex.js'
import {
  type HexToBytesErrorType,
  hexToBytes,
  type StringToBytesErrorType,
  stringToBytes,
} from '../encoding/toBytes.js'
import type { EncodeMessageErrorType } from './contracts/codec.js'
import {
  type FBytesErrorType,
  type FIntErrorType,
  type FMessageErrorType,
  fBytes,
  fInt,
  fMessage,
} from './protobuf/writer.js'
import {
  ContractType,
  type ContractTypeName,
  contractTypeNameOf,
  getContractCodecByTypeUrl,
} from './registry.js'
import type { ContractMessage, Int64 } from './types.js'

/**
 * One `Transaction.Contract` entry, in java-tron's JSON shape: the contract
 * `type` name, the `Any`-wrapped parameter (`type_url` + decoded message),
 * and an optional multi-sig `Permission_id` (java-tron's own capital-P
 * spelling).
 */
export type RawContract = {
  /** Contract type name (or its registered wire integer). */
  type: ContractTypeName | number
  /** `Any`-wrapped contract parameter. */
  parameter: {
    /** `Any.type_url`. */
    type_url: string
    /** Decoded contract message. */
    value: ContractMessage
  }
  /** Multi-sig permission id (`Transaction.Contract.Permission_id`). */
  Permission_id?: number | undefined
}

/**
 * A `Transaction.raw` in java-tron's JSON shape. Byte fields
 * (`ref_block_bytes`, `ref_block_hash`, `data`) are bare lowercase hex (no
 * `0x`); `int64` fields accept `bigint | number | string` on the encode side
 * (the canonical decoded form is a number, or a decimal string past 2^53).
 */
export type RawData = {
  /** TaPoS reference block bytes (field 1, bare hex). */
  ref_block_bytes?: string | undefined
  /** TaPoS reference block hash (field 4, bare hex). */
  ref_block_hash?: string | undefined
  /** Expiration timestamp in ms (field 8, `int64`). */
  expiration?: Int64 | undefined
  /** Memo/extra data (field 10, bare hex). */
  data?: string | undefined
  /** Contracts (field 11, repeated). */
  contract: RawContract[]
  /** Creation timestamp in ms (field 14, `int64`). */
  timestamp?: Int64 | undefined
  /** Energy/bandwidth fee ceiling in SUN (field 18, `int64`). */
  fee_limit?: Int64 | undefined
}

/** Prefixes a bare hex string with `0x` (leaves an already-prefixed one). */
function toHexInput(value: string): Hex {
  return (value.startsWith('0x') ? value : `0x${value}`) as Hex
}

/**
 * Resolves a contract `type` (name or integer) to its wire integer. Strict
 * by design: an unregistered integer or name throws — tviem refuses
 * transactions whose contract type it does not support.
 */
function contractTypeOf(type: ContractTypeName | number): number {
  if (typeof type === 'number') {
    if (contractTypeNameOf(type) === undefined)
      throw new UnknownContractTypeError({ type })
    return type
  }
  const value = ContractType[type]
  if (value === undefined) throw new UnknownContractTypeError({ type })
  return value
}

/** Throws when `object` carries a defined key outside `allowed`. */
function assertOnlyKeys(
  object: Record<string, unknown>,
  allowed: readonly string[],
  what: string,
): void {
  for (const key of Object.keys(object))
    if (object[key] !== undefined && !allowed.includes(key))
      throw new BaseError(`Unknown ${what} field "${key}".`)
}

/** Encodes one `Transaction.Contract` (type + `Any` parameter + permission). */
function serializeContract(contract: RawContract): ByteArray {
  // Strict by design (like `encodeMessage`): the sign path verifies supplied
  // JSON by re-serializing and comparing bytes — a silently dropped key
  // would let the JSON claim things the signed bytes do not carry.
  assertOnlyKeys(contract, ['type', 'parameter', 'Permission_id'], 'contract')
  assertOnlyKeys(
    contract.parameter,
    ['type_url', 'value'],
    'contract.parameter',
  )
  const { type_url, value } = contract.parameter
  const codec = getContractCodecByTypeUrl(type_url)
  if (!codec)
    throw new BaseError(`No contract codec registered for "${type_url}".`)
  const typeInt = contractTypeOf(contract.type)
  // The type (name or integer) and the Any type URL must denote the same
  // contract — a model whose label misrepresents its payload must never
  // serialize (the sign path byte-verifies whatever this emits).
  if (codec.type !== typeInt)
    throw new BaseError(
      `Contract type ${
        typeof contract.type === 'string' ? `"${contract.type}"` : contract.type
      } does not match its parameter type URL "${type_url}".`,
    )
  const valueBytes = codec.encode(value)
  const any = concatBytes([
    fBytes(1, stringToBytes(type_url)),
    fBytes(2, valueBytes),
  ])
  const parts = [fInt(1, typeInt), fBytes(2, any, { emitDefault: true })]
  if (contract.Permission_id) parts.push(fInt(5, contract.Permission_id))
  return concatBytes(parts)
}

export type SerializeRawDataErrorType =
  // Direct BaseError throws: unknown raw_data / contract / parameter key,
  // unregistered codec type_url, contract type / type-URL mismatch.
  | BaseErrorType
  // Unregistered contract type integer or name.
  | UnknownContractTypeErrorType
  // The registered codec's `encode` surface (address normalization included).
  | EncodeMessageErrorType
  | FBytesErrorType
  | FIntErrorType
  | FMessageErrorType
  | HexToBytesErrorType
  | StringToBytesErrorType
  | ErrorType

/**
 * Serializes a `Transaction.raw` model into its canonical protobuf bytes:
 * fields in ascending order (`ref_block_bytes` 1, `ref_block_hash` 4,
 * `expiration` 8, `data` 10, `contract` 11, `timestamp` 14, `fee_limit` 18),
 * proto3 defaults (zero/empty) omitted. Each contract is assembled as
 * `Contract → Any(type_url + value) → message`, with `Any.value` produced by
 * the registered codec's `encode`.
 *
 * @param rawData Raw data model.
 * @returns Canonical `raw_data` bytes.
 */
export function serializeRawData(rawData: RawData): ByteArray {
  assertOnlyKeys(
    rawData,
    [
      'ref_block_bytes',
      'ref_block_hash',
      'expiration',
      'data',
      'contract',
      'timestamp',
      'fee_limit',
    ],
    'raw_data',
  )
  const parts: ByteArray[] = []
  if (rawData.ref_block_bytes)
    parts.push(fBytes(1, hexToBytes(toHexInput(rawData.ref_block_bytes))))
  if (rawData.ref_block_hash)
    parts.push(fBytes(4, hexToBytes(toHexInput(rawData.ref_block_hash))))
  if (rawData.expiration) parts.push(fInt(8, BigInt(rawData.expiration)))
  if (rawData.data) parts.push(fBytes(10, hexToBytes(toHexInput(rawData.data))))
  for (const contract of rawData.contract)
    parts.push(fMessage(11, serializeContract(contract), { emitDefault: true }))
  if (rawData.timestamp) parts.push(fInt(14, BigInt(rawData.timestamp)))
  if (rawData.fee_limit) parts.push(fInt(18, BigInt(rawData.fee_limit)))
  return concatBytes(parts)
}

export type ToRawDataHexErrorType = SerializeRawDataErrorType | ErrorType

/**
 * Serializes a `Transaction.raw` model to its `raw_data_hex` string
 * (lowercase, no `0x` prefix), matching the form returned by TRON nodes.
 *
 * @param rawData Raw data model.
 * @returns `raw_data_hex` string.
 */
export function toRawDataHex(rawData: RawData): string {
  return bareHex(serializeRawData(rawData))
}
