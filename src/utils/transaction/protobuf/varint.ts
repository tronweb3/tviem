import {
  NegativeOffsetError,
  type NegativeOffsetErrorType,
  PositionOutOfBoundsError,
  type PositionOutOfBoundsErrorType,
} from '../../../errors/cursor.js'
import {
  IntegerOutOfRangeError,
  type IntegerOutOfRangeErrorType,
  VarintOverflowError,
  type VarintOverflowErrorType,
} from '../../../errors/encoding.js'
import type { ErrorType } from '../../../errors/utils.js'
import type { ByteArray } from '../../../types/misc.js'

/** Maximum value representable as a base-128 varint (`2^64 - 1`). */
export const maxUvarint = 18446744073709551615n

export type WriteUvarintErrorType = IntegerOutOfRangeErrorType | ErrorType

/**
 * Encodes an unsigned integer into base-128 varint bytes
 * (little-endian groups of 7 bits, high bit = continuation).
 *
 * @param value Unsigned integer (`0` to `2^64 - 1`).
 * @returns Varint byte array (1–10 bytes).
 */
export function writeUvarint(value: bigint): ByteArray {
  if (value < 0n || value > maxUvarint)
    throw new IntegerOutOfRangeError({
      max: maxUvarint.toString(),
      min: '0',
      signed: false,
      size: 8,
      value: value.toString(),
    })
  const bytes: number[] = []
  let remaining = value
  while (remaining >= 0x80n) {
    bytes.push(Number(remaining & 0x7fn) | 0x80)
    remaining >>= 7n
  }
  bytes.push(Number(remaining))
  return new Uint8Array(bytes)
}

export type ReadUvarintReturnType = {
  /** Number of bytes consumed. */
  size: number
  /** Decoded unsigned integer. */
  value: bigint
}

export type ReadUvarintErrorType =
  | NegativeOffsetErrorType
  | PositionOutOfBoundsErrorType
  | VarintOverflowErrorType
  | ErrorType

/**
 * Decodes a base-128 varint from `bytes`, starting at `offset`.
 *
 * Throws when the data is truncated (a continuation bit points past the
 * end) or when the value overflows a 64-bit unsigned integer.
 *
 * @param bytes Byte array to read from.
 * @param offset Byte offset to start reading at.
 * @returns Decoded value and the number of bytes consumed.
 */
export function readUvarint(
  bytes: ByteArray,
  offset = 0,
): ReadUvarintReturnType {
  if (offset < 0) throw new NegativeOffsetError({ offset })
  let value = 0n
  let shift = 0n
  for (let i = 0; i < 10; i++) {
    const position = offset + i
    if (position >= bytes.length)
      throw new PositionOutOfBoundsError({ length: bytes.length, position })
    const byte = bytes[position]!
    // The 10th byte may only carry the top bit of a 64-bit value.
    if (i === 9 && byte > 0x01) throw new VarintOverflowError()
    value |= BigInt(byte & 0x7f) << shift
    if ((byte & 0x80) === 0) return { size: i + 1, value }
    shift += 7n
  }
  throw new VarintOverflowError()
}
