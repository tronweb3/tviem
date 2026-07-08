import {
  PositionOutOfBoundsError,
  type PositionOutOfBoundsErrorType,
} from '../../../errors/cursor.js'
import {
  IntegerOutOfRangeError,
  type IntegerOutOfRangeErrorType,
  UnsupportedWireTypeError,
  type UnsupportedWireTypeErrorType,
} from '../../../errors/encoding.js'
import type { ErrorType } from '../../../errors/utils.js'
import type { ByteArray } from '../../../types/misc.js'
import { type ReadUvarintErrorType, readUvarint } from './varint.js'
import { maxFieldNumber } from './writer.js'

/**
 * A single decoded protobuf field.
 *
 * `VARINT` (wire type 0) fields decode to a raw unsigned `bigint`;
 * `LEN` (2), `I64` (1) and `I32` (5) fields decode to a view over the
 * payload bytes.
 */
export type ProtoField =
  | { fieldNo: number; wireType: 0; value: bigint }
  | { fieldNo: number; wireType: 1; value: ByteArray }
  | { fieldNo: number; wireType: 2; value: ByteArray }
  | { fieldNo: number; wireType: 5; value: ByteArray }

export type ReadFieldsErrorType =
  | IntegerOutOfRangeErrorType
  | PositionOutOfBoundsErrorType
  | ReadUvarintErrorType
  | UnsupportedWireTypeErrorType
  | ErrorType

/**
 * Iterates over the `(fieldNo, wireType, value)` triples of an encoded
 * protobuf message.
 *
 * Wire types 0 (`VARINT`) and 2 (`LEN`) are fully decoded; wire types 1
 * (`I64`) and 5 (`I32`) are tolerated and yielded with their raw 8/4-byte
 * payload; wire types 3, 4, 6 and 7 throw. Truncated data throws.
 *
 * @param bytes Encoded message.
 * @returns Generator of decoded fields.
 */
export function* readFields(
  bytes: ByteArray,
): Generator<ProtoField, void, undefined> {
  let position = 0
  while (position < bytes.length) {
    const key = readUvarint(bytes, position)
    position += key.size
    const fieldNo = Number(key.value >> 3n)
    const wireType = Number(key.value & 0x07n)
    if (fieldNo < 1 || fieldNo > maxFieldNumber)
      throw new IntegerOutOfRangeError({
        max: maxFieldNumber.toString(),
        min: '1',
        value: String(fieldNo),
      })
    switch (wireType) {
      case 0: {
        const { size, value } = readUvarint(bytes, position)
        position += size
        yield { fieldNo, wireType, value }
        break
      }
      case 1:
      case 5: {
        const width = wireType === 1 ? 8 : 4
        if (position + width > bytes.length)
          throw new PositionOutOfBoundsError({
            length: bytes.length,
            position: position + width - 1,
          })
        yield {
          fieldNo,
          wireType,
          value: bytes.subarray(position, position + width),
        }
        position += width
        break
      }
      case 2: {
        const length_ = readUvarint(bytes, position)
        position += length_.size
        if (BigInt(position) + length_.value > BigInt(bytes.length))
          throw new PositionOutOfBoundsError({
            length: bytes.length,
            position: position + Number(length_.value) - 1,
          })
        const length = Number(length_.value)
        yield {
          fieldNo,
          wireType,
          value: bytes.subarray(position, position + length),
        }
        position += length
        break
      }
      default:
        throw new UnsupportedWireTypeError({ wireType })
    }
  }
}

export type ReadMessageFieldsErrorType = ReadFieldsErrorType | ErrorType

/**
 * Decodes all fields of an encoded protobuf message into an array.
 * Convenience wrapper around `readFields`.
 *
 * @param bytes Encoded message.
 * @returns Decoded fields, in encounter order (repeated fields appear
 * once per occurrence).
 */
export function readMessageFields(bytes: ByteArray): ProtoField[] {
  return Array.from(readFields(bytes))
}
