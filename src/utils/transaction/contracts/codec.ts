import { BaseError, type BaseErrorType } from '../../../errors/base.js'
import type { ErrorType } from '../../../errors/utils.js'
import type { TronHexAddress } from '../../../types/address.js'
import type { ByteArray, Hex } from '../../../types/misc.js'
import { concatBytes } from '../../data/concat.js'
import { bareHex } from '../../encoding/bareHex.js'
import { bytesToString } from '../../encoding/fromBytes.js'
import {
  type HexToBytesErrorType,
  hexToBytes,
  stringToBytes,
} from '../../encoding/toBytes.js'
import { bytesToHex } from '../../encoding/toHex.js'
import { int64ToJson } from '../int64.js'
import {
  type NormalizeAddressErrorType,
  normalizeAddress,
} from '../normalize.js'
import {
  type ReadFieldsErrorType,
  readMessageFields,
} from '../protobuf/reader.js'
import {
  type FBoolErrorType,
  type FBytesErrorType,
  type FIntErrorType,
  fBool,
  fBytes,
  fInt,
  fMessage,
} from '../protobuf/writer.js'
import type { BytesInput, ContractAddressInput, Int64 } from '../types.js'

/**
 * Declarative schema of a single protobuf field of a contract message. The
 * `name` is the canonical JSON key — the proto field name exactly as
 * java-tron's JsonFormat renders it. `enum` fields carry their value→name
 * table (`names[wireValue]`), matching JsonFormat's name rendering.
 *
 * Scalar kinds map to wire types as follows: `i64`/`i32`/`enum`/`bool` →
 * `VARINT` (0); `address`/`bytes`/`string`/`message`/`repeated-message` →
 * `LEN` (2).
 */
export type FieldSpec =
  | {
      no: number
      name: string
      kind: 'address' | 'bytes' | 'string' | 'i64' | 'i32' | 'bool'
    }
  | { no: number; name: string; kind: 'enum'; names: readonly string[] }
  | { no: number; name: string; kind: 'message'; spec: MessageSpec }
  | { no: number; name: string; kind: 'repeated-message'; spec: MessageSpec }

/** Declarative schema of a contract message (one entry per field). */
export type MessageSpec = readonly FieldSpec[]

/** Maximum value of a two's-complement 64-bit signed integer (`2^63 - 1`). */
const maxInt64 = 9223372036854775807n
/** Offset used to decode negative `int64` values from two's complement. */
const twoPow64 = 18446744073709551616n

export type EncodeMessageErrorType =
  | NormalizeAddressErrorType
  | HexToBytesErrorType
  | FBytesErrorType
  | FIntErrorType
  | FBoolErrorType
  | BaseErrorType
  | ErrorType

/**
 * Encodes a message object against its field schema, in canonical form:
 * fields in ascending field-number order, proto3 defaults (zero/empty/false)
 * omitted. `undefined`/`null` values are omitted.
 *
 * Strict by design: a property that is not in the schema throws. The sign
 * path verifies a supplied `raw_data` JSON by re-serializing it and
 * comparing bytes — silently dropping unknown properties would let a JSON
 * claim fields that are not in the bytes it describes.
 *
 * @param spec Message field schema.
 * @param message Message object (keyed by `FieldSpec.name`).
 * @returns Encoded message body.
 */
export function encodeMessage(
  spec: MessageSpec,
  message: Record<string, unknown>,
): ByteArray {
  for (const key of Object.keys(message))
    if (message[key] !== undefined && !spec.some((field) => field.name === key))
      throw new BaseError(`Unknown contract message field "${key}".`)
  const parts: ByteArray[] = []
  for (const field of [...spec].sort((a, b) => a.no - b.no)) {
    const value = message[field.name]
    if (value === undefined || value === null) continue
    parts.push(encodeField(field, value))
  }
  return concatBytes(parts)
}

/** Encodes one field per its schema entry. */
function encodeField(field: FieldSpec, value: unknown): ByteArray {
  switch (field.kind) {
    case 'address':
      return fBytes(field.no, normalizeAddress(value as ContractAddressInput))
    case 'bytes':
      return fBytes(field.no, bytesInputToBytes(value as BytesInput))
    case 'string':
      return fBytes(field.no, stringToBytes(value as string))
    case 'i64':
    case 'i32':
      return fInt(field.no, int64InputToBigInt(value as Int64))
    case 'enum': {
      if (typeof value !== 'string') return fInt(field.no, value as number)
      const index = field.names.indexOf(value)
      if (index === -1)
        throw new BaseError(`Unknown ${field.name} enum name "${value}".`)
      return fInt(field.no, index)
    }
    case 'bool':
      return fBool(field.no, Boolean(value))
    case 'message':
      return fMessage(
        field.no,
        encodeMessage(field.spec, value as Record<string, unknown>),
        { emitDefault: true },
      )
    case 'repeated-message':
      return concatBytes(
        (value as readonly Record<string, unknown>[]).map((item) =>
          fMessage(field.no, encodeMessage(field.spec, item), {
            emitDefault: true,
          }),
        ),
      )
  }
}

/** Converts an `int64` input (bigint, number, or decimal string) to bigint. */
function int64InputToBigInt(value: Int64): bigint {
  return BigInt(value)
}

/** Converts a bytes field input (hex or raw bytes) to bytes. */
function bytesInputToBytes(value: BytesInput): ByteArray {
  if (value instanceof Uint8Array) return value
  return hexToBytes((value.startsWith('0x') ? value : `0x${value}`) as Hex)
}

export type DecodeMessageErrorType =
  | ReadFieldsErrorType
  | BaseErrorType
  | ErrorType

/**
 * Decodes a message body against its field schema into the canonical form —
 * exactly what java-tron's JsonFormat emits for `visible: false`:
 *
 * - Addresses decode to `41…` bare lowercase hex; `bytes` fields to bare
 *   lowercase hex (no `0x`).
 * - `int64` decodes via `int64ToJson` (a JSON number within `±(2^53 − 1)`,
 *   else a decimal string); `enum` decodes to its name string, falling back
 *   to the number for values outside the table — the one divergence from
 *   JsonFormat, which still knows names our narrowed tables dropped (e.g.
 *   `ResourceCode` 2 decodes here as `2`, not `'TRON_POWER'`).
 * - proto3 defaults are omitted: a field absent from the wire is absent
 *   from the result (JsonFormat prints only set fields).
 * - Strict by design: a wire field outside the schema (or with an
 *   unexpected wire type) throws — bytes the schema cannot represent must
 *   never decode to a model that misrepresents them. Duplicated
 *   non-repeated fields follow last-one-wins.
 *
 * @param spec Message field schema.
 * @param bytes Encoded message body.
 * @returns Decoded message object.
 */
export function decodeMessage(
  spec: MessageSpec,
  bytes: ByteArray,
): Record<string, unknown> {
  const message: Record<string, unknown> = {}
  const specByNo = new Map<number, FieldSpec>()
  for (const field of spec) specByNo.set(field.no, field)

  for (const wire of readMessageFields(bytes)) {
    const field = specByNo.get(wire.fieldNo)
    if (!field || wireTypeOf(field.kind) !== wire.wireType)
      throw new BaseError(
        `Unknown wire field ${wire.fieldNo} (wire type ${wire.wireType}) in contract message.`,
      )
    switch (field.kind) {
      case 'i64':
        message[field.name] = int64ToJson(toInt64(wire.value as bigint))
        break
      case 'i32':
        message[field.name] = Number(toInt64(wire.value as bigint))
        break
      case 'enum': {
        const value = Number(toInt64(wire.value as bigint))
        message[field.name] = field.names[value] ?? value
        break
      }
      case 'bool':
        message[field.name] = (wire.value as bigint) !== 0n
        break
      case 'address':
        message[field.name] = bytesToHex(wire.value as ByteArray).slice(
          2,
        ) as TronHexAddress
        break
      case 'bytes':
        message[field.name] = bareHex(wire.value as ByteArray)
        break
      case 'string':
        message[field.name] = bytesToString(wire.value as ByteArray)
        break
      case 'message':
        message[field.name] = decodeMessage(field.spec, wire.value as ByteArray)
        break
      case 'repeated-message': {
        const list = (message[field.name] as unknown[] | undefined) ?? []
        list.push(decodeMessage(field.spec, wire.value as ByteArray))
        message[field.name] = list
        break
      }
    }
  }

  return message
}

/** Wire type a field kind is expected to arrive with. */
function wireTypeOf(kind: FieldSpec['kind']): 0 | 2 {
  switch (kind) {
    case 'i64':
    case 'i32':
    case 'enum':
    case 'bool':
      return 0
    default:
      return 2
  }
}

/** Reinterprets a raw unsigned varint as a signed two's-complement `int64`. */
function toInt64(value: bigint): bigint {
  return value > maxInt64 ? value - twoPow64 : value
}
