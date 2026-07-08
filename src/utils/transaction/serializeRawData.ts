import { BaseError } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import { concatBytes } from '../data/concat.js'
import {
  type HexToBytesErrorType,
  hexToBytes,
  type StringToBytesErrorType,
  stringToBytes,
} from '../encoding/toBytes.js'
import { bytesToHex } from '../encoding/toHex.js'
import {
  type FBytesErrorType,
  type FIntErrorType,
  type FMessageErrorType,
  fBytes,
  fInt,
  fMessage,
} from './protobuf/writer.js'
import { getContractCodecByTypeUrl } from './registry.js'
import type { ContractMessage, UnknownContractParameter } from './types.js'

/**
 * One `Transaction.Contract` entry: the contract `type` integer, the
 * `Any`-wrapped parameter (its type URL and decoded message body), and an
 * optional multi-sig `Permission_id`.
 */
export type RawContract = {
  /** `Transaction.Contract.type` integer (see `ContractType`). */
  type: number
  /** `Any`-wrapped contract parameter. */
  parameter: {
    /** `Any.type_url`. */
    typeUrl: string
    /** Decoded contract message, or the unknown-parameter fallback. */
    value: ContractMessage | UnknownContractParameter
  }
  /** Multi-sig permission id (`Transaction.Contract.Permission_id`). */
  permissionId?: number | undefined
}

/**
 * A `Transaction.raw` model. Byte fields (`refBlockBytes`, `refBlockHash`,
 * `data`) are bare lowercase hex (no `0x`); `int64` fields are `bigint`
 * (numbers are accepted on the encode side).
 */
export type RawData = {
  /** TaPoS reference block bytes (field 1, bare hex). */
  refBlockBytes?: string | undefined
  /** TaPoS reference block hash (field 4, bare hex). */
  refBlockHash?: string | undefined
  /** Expiration timestamp in ms (field 8, `int64`). */
  expiration?: bigint | number | undefined
  /** Memo/extra data (field 10, bare hex). */
  data?: string | undefined
  /** Contracts (field 11, repeated). */
  contract: RawContract[]
  /** Creation timestamp in ms (field 14, `int64`). */
  timestamp?: bigint | number | undefined
  /** Energy/bandwidth fee ceiling in SUN (field 18, `int64`). */
  feeLimit?: bigint | number | undefined
}

/** Prefixes a bare hex string with `0x` (leaves an already-prefixed one). */
function toHexInput(value: string): Hex {
  return (value.startsWith('0x') ? value : `0x${value}`) as Hex
}

/** Discriminates the unknown-parameter fallback from a decoded message. */
function isUnknownParameter(
  value: ContractMessage | UnknownContractParameter,
): value is UnknownContractParameter {
  return (value as UnknownContractParameter).__unknown === true
}

/** Encodes one `Transaction.Contract` (type + `Any` parameter + permission). */
function serializeContract(contract: RawContract): ByteArray {
  const { typeUrl, value } = contract.parameter
  let valueBytes: ByteArray
  if (isUnknownParameter(value)) valueBytes = value.valueBytes
  else {
    const codec = getContractCodecByTypeUrl(typeUrl)
    if (!codec)
      throw new BaseError(`No contract codec registered for "${typeUrl}".`)
    valueBytes = codec.encode(value)
  }
  const any = concatBytes([
    fBytes(1, stringToBytes(typeUrl)),
    fBytes(2, valueBytes),
  ])
  const parts = [fInt(1, contract.type), fBytes(2, any, { emitDefault: true })]
  if (contract.permissionId) parts.push(fInt(5, contract.permissionId))
  return concatBytes(parts)
}

export type SerializeRawDataErrorType =
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
  const parts: ByteArray[] = []
  if (rawData.refBlockBytes)
    parts.push(fBytes(1, hexToBytes(toHexInput(rawData.refBlockBytes))))
  if (rawData.refBlockHash)
    parts.push(fBytes(4, hexToBytes(toHexInput(rawData.refBlockHash))))
  if (rawData.expiration) parts.push(fInt(8, BigInt(rawData.expiration)))
  if (rawData.data) parts.push(fBytes(10, hexToBytes(toHexInput(rawData.data))))
  for (const contract of rawData.contract)
    parts.push(fMessage(11, serializeContract(contract), { emitDefault: true }))
  if (rawData.timestamp) parts.push(fInt(14, BigInt(rawData.timestamp)))
  if (rawData.feeLimit) parts.push(fInt(18, BigInt(rawData.feeLimit)))
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
  return bytesToHex(serializeRawData(rawData)).slice(2)
}
