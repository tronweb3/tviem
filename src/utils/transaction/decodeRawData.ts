import { BaseError } from '../../errors/base.js'
import {
  UnknownContractTypeError,
  type UnknownContractTypeErrorType,
} from '../../errors/transaction.js'
import type { ErrorType } from '../../errors/utils.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import { bareHex } from '../encoding/bareHex.js'
import { bytesToString } from '../encoding/fromBytes.js'
import { hexToBytes } from '../encoding/toBytes.js'
import type { DecodeMessageErrorType } from './contracts/codec.js'
import { int64ToJson } from './int64.js'
import {
  type ReadFieldsErrorType,
  readMessageFields,
} from './protobuf/reader.js'
import {
  contractTypeNameOf,
  decodeContractParameter,
  getContractCodecByTypeUrl,
} from './registry.js'
import type { RawContract, RawData } from './serializeRawData.js'

/** Maximum value of a two's-complement 64-bit signed integer (`2^63 - 1`). */
const maxInt64 = 9223372036854775807n
/** Offset used to decode negative `int64` values from two's complement. */
const twoPow64 = 18446744073709551616n

/** Reinterprets a raw unsigned varint as a signed two's-complement `int64`. */
function toInt64(value: bigint): bigint {
  return value > maxInt64 ? value - twoPow64 : value
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
 * Decodes one `Transaction.Contract` into the canonical (node JSON) shape:
 * the contract `type` as its enum name, `parameter.type_url`, and
 * `Permission_id`. The `provider` (field 3) and `ContractName` (field 4)
 * fields are tolerated (ignored) rather than decoded. Strict by design: an
 * unregistered contract type (type integer or `Any` type URL) throws
 * {@link UnknownContractTypeError}.
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
        // `Permission_id` is `int32`: low 32 bits, sign-extended, matching
        // java-tron's parser. Reading the raw varint instead would render a
        // negative id as a ~1.8e19 positive number.
        if (field.wireType === 0)
          permissionId = Number(BigInt.asIntN(32, field.value as bigint))
        break
      default:
        break
    }
  }
  const typeName = contractTypeNameOf(type)
  if (typeName === undefined) throw new UnknownContractTypeError({ type })
  const value = decodeContractParameter(typeUrl, valueBytes)
  // The type integer and the Any type URL must denote the same contract — a
  // model whose label misrepresents its payload must never decode.
  if (getContractCodecByTypeUrl(typeUrl)?.type !== type)
    throw new BaseError(
      `Contract type "${typeName}" does not match its parameter type URL "${typeUrl}".`,
    )
  const contract: RawContract = {
    type: typeName,
    parameter: {
      type_url: typeUrl,
      value,
    },
  }
  if (permissionId !== undefined) contract.Permission_id = permissionId
  return contract
}

export type DecodeRawDataErrorType =
  | ReadFieldsErrorType
  | UnknownContractTypeErrorType
  // Contract-body decode errors (unknown wire field, type/type-URL
  // mismatch): `BaseErrorType` via the codec decode surface.
  | DecodeMessageErrorType
  | ErrorType

/**
 * Decodes canonical `raw_data` bytes (or hex) back into the canonical
 * {@link RawData} JSON shape — the inverse of `serializeRawData` and exactly
 * java-tron's `visible: false` rendering. The raw-level `ref_block_num` (3),
 * witness (9) and scripts (12) fields, and the contract-level `provider`
 * (3)/`ContractName` (4) fields, are tolerated (ignored). Strict on contract
 * content: an unsupported contract type throws
 * {@link UnknownContractTypeError}, and wire fields a contract schema does
 * not model throw rather than decode to a misrepresenting model.
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
        if (field.wireType === 2) rawData.ref_block_bytes = bareHex(field.value)
        break
      case 4:
        if (field.wireType === 2) rawData.ref_block_hash = bareHex(field.value)
        break
      case 8:
        if (field.wireType === 0)
          rawData.expiration = int64ToJson(toInt64(field.value))
        break
      case 10:
        if (field.wireType === 2) rawData.data = bareHex(field.value)
        break
      case 11:
        if (field.wireType === 2)
          rawData.contract.push(decodeContract(field.value))
        break
      case 14:
        if (field.wireType === 0)
          rawData.timestamp = int64ToJson(toInt64(field.value))
        break
      case 18:
        if (field.wireType === 0)
          rawData.fee_limit = int64ToJson(toInt64(field.value))
        break
      default:
        break
    }
  }
  return rawData
}
