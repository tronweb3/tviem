import type { ErrorType } from '../../errors/utils.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import { bytesToString } from '../encoding/fromBytes.js'
import { hexToBytes } from '../encoding/toBytes.js'
import { bytesToHex } from '../encoding/toHex.js'
import {
  type ReadFieldsErrorType,
  readMessageFields,
} from './protobuf/reader.js'
import { decodeContractParameter } from './registry.js'
import type { RawContract, RawData } from './serializeRawData.js'

/** Maximum value of a two's-complement 64-bit signed integer (`2^63 - 1`). */
const maxInt64 = 9223372036854775807n
/** Offset used to decode negative `int64` values from two's complement. */
const twoPow64 = 18446744073709551616n

/** Reinterprets a raw unsigned varint as a signed two's-complement `int64`. */
function toInt64(value: bigint): bigint {
  return value > maxInt64 ? value - twoPow64 : value
}

/** Bare lowercase hex (no `0x`) of a byte payload. */
function bareHex(bytes: ByteArray): string {
  return bytesToHex(bytes).slice(2)
}

/** Decodes a `google.protobuf.Any`, returning its type URL and value bytes. */
function decodeAny(bytes: ByteArray): {
  typeUrl: string
  valueBytes: ByteArray
} {
  let typeUrl = ''
  let valueBytes: ByteArray = new Uint8Array(0)
  for (const field of readMessageFields(bytes)) {
    if (field.fieldNo === 1 && field.wireType === 2)
      typeUrl = bytesToString(field.value)
    else if (field.fieldNo === 2 && field.wireType === 2)
      valueBytes = field.value
  }
  return { typeUrl, valueBytes }
}

/**
 * Decodes one `Transaction.Contract`. The `provider` (field 3) and
 * `ContractName` (field 4) fields are tolerated (ignored) rather than
 * decoded; an unregistered `Any` type URL falls back to
 * `UnknownContractParameter` instead of throwing.
 */
function decodeContract(bytes: ByteArray): RawContract {
  let type = 0
  let typeUrl = ''
  let valueBytes: ByteArray = new Uint8Array(0)
  let permissionId: number | undefined
  for (const field of readMessageFields(bytes)) {
    switch (field.fieldNo) {
      case 1:
        if (field.wireType === 0) type = Number(field.value)
        break
      case 2:
        if (field.wireType === 2)
          ({ typeUrl, valueBytes } = decodeAny(field.value))
        break
      case 5:
        if (field.wireType === 0) permissionId = Number(field.value)
        break
      default:
        break
    }
  }
  const contract: RawContract = {
    type,
    parameter: { typeUrl, value: decodeContractParameter(typeUrl, valueBytes) },
  }
  if (permissionId !== undefined) contract.permissionId = permissionId
  return contract
}

export type DecodeRawDataErrorType = ReadFieldsErrorType | ErrorType

/**
 * Decodes canonical `raw_data` bytes (or hex) back into a `RawData` model —
 * the inverse of `serializeRawData`. Tolerant by design: the raw-level
 * `ref_block_num` (3), witness (9) and scripts (12) fields, and the
 * contract-level `provider` (3)/`ContractName` (4) fields, are ignored;
 * unregistered contract types fall back to `UnknownContractParameter`.
 *
 * @param input `raw_data` bytes, or hex (bare or `0x`-prefixed).
 * @returns Decoded raw data model.
 */
export function decodeRawData(input: ByteArray | Hex | string): RawData {
  const bytes =
    typeof input === 'string'
      ? hexToBytes((input.startsWith('0x') ? input : `0x${input}`) as Hex)
      : input
  const rawData: RawData = { contract: [] }
  for (const field of readMessageFields(bytes)) {
    switch (field.fieldNo) {
      case 1:
        if (field.wireType === 2) rawData.refBlockBytes = bareHex(field.value)
        break
      case 4:
        if (field.wireType === 2) rawData.refBlockHash = bareHex(field.value)
        break
      case 8:
        if (field.wireType === 0) rawData.expiration = toInt64(field.value)
        break
      case 10:
        if (field.wireType === 2) rawData.data = bareHex(field.value)
        break
      case 11:
        if (field.wireType === 2)
          rawData.contract.push(decodeContract(field.value))
        break
      case 14:
        if (field.wireType === 0) rawData.timestamp = toInt64(field.value)
        break
      case 18:
        if (field.wireType === 0) rawData.feeLimit = toInt64(field.value)
        break
      default:
        break
    }
  }
  return rawData
}
