import {
  IntegerOutOfRangeError,
  type IntegerOutOfRangeErrorType,
  UnsupportedWireTypeError,
  type UnsupportedWireTypeErrorType,
} from '../../../errors/encoding.js'
import type { ErrorType } from '../../../errors/utils.js'
import type { ByteArray } from '../../../types/misc.js'
import { concatBytes } from '../../data/concat.js'
import { type WriteUvarintErrorType, writeUvarint } from './varint.js'

/** Protobuf wire types. */
export const WireType = {
  Varint: 0,
  Fixed64: 1,
  Len: 2,
  Fixed32: 5,
} as const
export type WireType = (typeof WireType)[keyof typeof WireType]

/** Maximum protobuf field number (`2^29 - 1`). */
export const maxFieldNumber = 536870911

/** Bounds of a two's-complement 64-bit signed integer (protobuf `int64`). */
const minInt64 = -9223372036854775808n
const maxInt64 = 9223372036854775807n
/** Bounds of a two's-complement 32-bit signed integer (protobuf `int32`). */
const minInt32 = -2147483648n
const maxInt32 = 2147483647n
/** Offset used to encode negative `int64` values as two's complement. */
const twoPow64 = 18446744073709551616n

export type TagErrorType =
  | IntegerOutOfRangeErrorType
  | UnsupportedWireTypeErrorType
  | WriteUvarintErrorType
  | ErrorType

/**
 * Encodes a field key (`fieldNo << 3 | wireType`) as a varint.
 *
 * @param fieldNo Field number (`1` to `2^29 - 1`).
 * @param wireType Wire type (`0`, `1`, `2` or `5`).
 * @returns Encoded key bytes.
 */
export function tag(fieldNo: number, wireType: WireType | number): ByteArray {
  if (!Number.isInteger(fieldNo) || fieldNo < 1 || fieldNo > maxFieldNumber)
    throw new IntegerOutOfRangeError({
      max: maxFieldNumber.toString(),
      min: '1',
      value: String(fieldNo),
    })
  if (
    wireType !== WireType.Varint &&
    wireType !== WireType.Fixed64 &&
    wireType !== WireType.Len &&
    wireType !== WireType.Fixed32
  )
    throw new UnsupportedWireTypeError({ wireType })
  return writeUvarint((BigInt(fieldNo) << 3n) | BigInt(wireType))
}

type FBytesOptions = {
  /** Emits empty bytes as an explicit `LEN`-typed field instead of omitting it. */
  emitDefault?: boolean | undefined
}

export type FBytesErrorType = TagErrorType | ErrorType

/**
 * Encodes a `LEN`-typed field (bytes/string/embedded message):
 * key + length varint + payload.
 *
 * Follows proto3 semantics: empty payloads encode to an empty byte array
 * (field omitted) unless `emitDefault` is set.
 *
 * @param fieldNo Field number.
 * @param bytes Field payload.
 * @param options Encoding options.
 * @returns Encoded field bytes.
 */
export function fBytes(
  fieldNo: number,
  bytes: ByteArray,
  options: FBytesOptions = {},
): ByteArray {
  const { emitDefault = false } = options
  if (bytes.length === 0 && !emitDefault) return new Uint8Array(0)
  return concatBytes([
    tag(fieldNo, WireType.Len),
    writeUvarint(BigInt(bytes.length)),
    bytes,
  ])
}

export type FIntErrorType =
  | IntegerOutOfRangeErrorType
  | TagErrorType
  | ErrorType

/**
 * Encodes a signed `int64` `VARINT`-typed field. Narrower signed varint
 * fields ({@link fInt32}, enums) layer their own tighter bound on top before
 * delegating here.
 *
 * Follows proto3 semantics: `0` encodes to an empty byte array (field
 * omitted). Negative values are encoded as 64-bit two's complement
 * (always 10 bytes), matching standard `int64` behavior.
 *
 * The bound is signed `int64`, not the full unsigned varint range: every
 * varint field TRON declares is signed `int64`, so a value above `2^63 - 1`
 * would encode to a varint that decodes back as a negative number — a
 * round-trip the sender never wrote. (A genuine `uint64` field, were one ever
 * added, would need its own wider encoder.)
 *
 * @param fieldNo Field number.
 * @param value Integer value (`-(2^63)` to `2^63 - 1`).
 * @returns Encoded field bytes.
 */
export function fInt(fieldNo: number, value: bigint | number): ByteArray {
  const value_ = BigInt(value)
  if (value_ === 0n) return new Uint8Array(0)
  if (value_ < minInt64 || value_ > maxInt64)
    throw new IntegerOutOfRangeError({
      max: maxInt64.toString(),
      min: minInt64.toString(),
      signed: true,
      size: 8,
      value: value_.toString(),
    })
  const unsigned = value_ < 0n ? value_ + twoPow64 : value_
  return concatBytes([tag(fieldNo, WireType.Varint), writeUvarint(unsigned)])
}

export type FInt32ErrorType = FIntErrorType

/**
 * Encodes an `int32` field — {@link fInt} bounded to the declared wire type.
 *
 * The encoding is identical (protobuf writes `int32` as a plain varint,
 * negatives sign-extended to 64 bits); only the accepted range differs. The
 * bound is not client-side strictness: java-tron never accepts a wider value
 * as written. Its JSON endpoint refuses to parse one (`JsonFormat.parseInt32`
 * throws, and `Util.packTransaction` then drops the whole contract), while on
 * the byte-exact path `Transaction.parseFrom` truncates to the low 32 bits —
 * and because the contract body rides inside an `Any`, whose `value` is a
 * `bytes` field, that truncation happens at `any.unpack()` AFTER the signature
 * is verified. The transaction commits a value the signer never wrote.
 *
 * @param fieldNo Field number.
 * @param value Integer value (`-(2^31)` to `2^31 - 1`).
 * @returns Encoded field bytes.
 */
export function fInt32(fieldNo: number, value: bigint | number): ByteArray {
  const value_ = BigInt(value)
  if (value_ < minInt32 || value_ > maxInt32)
    throw new IntegerOutOfRangeError({
      max: maxInt32.toString(),
      min: minInt32.toString(),
      signed: true,
      size: 4,
      value: value_.toString(),
    })
  return fInt(fieldNo, value_)
}

export type FBoolErrorType = TagErrorType | ErrorType

/**
 * Encodes a `bool` field.
 *
 * Follows proto3 semantics: `false` encodes to an empty byte array
 * (field omitted).
 *
 * @param fieldNo Field number.
 * @param value Boolean value.
 * @returns Encoded field bytes.
 */
export function fBool(fieldNo: number, value: boolean): ByteArray {
  if (!value) return new Uint8Array(0)
  return concatBytes([tag(fieldNo, WireType.Varint), new Uint8Array([1])])
}

export type FEnumErrorType = FIntErrorType | ErrorType

/**
 * Encodes an `enum` field.
 *
 * Follows proto3 semantics: the zero variant encodes to an empty byte
 * array (field omitted).
 *
 * @param fieldNo Field number.
 * @param value Enum variant as an integer.
 * @returns Encoded field bytes.
 */
export function fEnum(fieldNo: number, value: number): ByteArray {
  return fInt(fieldNo, value)
}

export type FMessageErrorType = FBytesErrorType | ErrorType

/**
 * Encodes an embedded message field from its already-encoded bytes.
 * Identical to `fBytes`: empty messages are omitted unless `emitDefault`
 * is set.
 *
 * @param fieldNo Field number.
 * @param encoded Encoded message payload.
 * @param options Encoding options.
 * @returns Encoded field bytes.
 */
export function fMessage(
  fieldNo: number,
  encoded: ByteArray,
  options: FBytesOptions = {},
): ByteArray {
  return fBytes(fieldNo, encoded, options)
}
