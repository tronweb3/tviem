import { InvalidBytesBooleanError } from '../../errors/encoding.js'
import type { ErrorType } from '../../errors/utils.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import { type AssertSizeErrorType, assertSize } from '../data/size.js'
import { type TrimErrorType, trim } from '../data/trim.js'

import {
  type HexToBigIntErrorType,
  type HexToNumberErrorType,
  hexToBigInt,
  hexToNumber,
} from './fromHex.js'
import { type BytesToHexErrorType, bytesToHex } from './toHex.js'

export type FromBytesParameters<
  to extends 'string' | 'hex' | 'bigint' | 'number' | 'boolean',
> =
  | to
  | {
      /** Size of the bytes. */
      size?: number | undefined
      /** Type to convert to. */
      to: to
    }

export type FromBytesReturnType<to> = to extends 'string'
  ? string
  : to extends 'hex'
    ? Hex
    : to extends 'bigint'
      ? bigint
      : to extends 'number'
        ? number
        : to extends 'boolean'
          ? boolean
          : never

export type FromBytesErrorType =
  | BytesToHexErrorType
  | BytesToBigIntErrorType
  | BytesToBoolErrorType
  | BytesToNumberErrorType
  | BytesToStringErrorType
  | ErrorType

/**
 * Decodes a byte array into a UTF-8 string, hex value, number, bigint or boolean.
 *
 * @param bytes Byte array to decode.
 * @param toOrOpts Type to convert to or options.
 * @returns Decoded value.
 *
 * @example
 * import { fromBytes } from '@tronweb3/tviem'
 * const data = fromBytes(new Uint8Array([1, 164]), 'number')
 * // 420
 *
 * @example
 * import { fromBytes } from '@tronweb3/tviem'
 * const data = fromBytes(
 *   new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33]),
 *   'string'
 * )
 * // 'Hello world'
 */
export function fromBytes<
  to extends 'string' | 'hex' | 'bigint' | 'number' | 'boolean',
>(
  bytes: ByteArray,
  toOrOpts: FromBytesParameters<to>,
): FromBytesReturnType<to> {
  const opts = typeof toOrOpts === 'string' ? { to: toOrOpts } : toOrOpts
  const to = opts.to

  if (to === 'number')
    return bytesToNumber(bytes, opts) as FromBytesReturnType<to>
  if (to === 'bigint')
    return bytesToBigInt(bytes, opts) as FromBytesReturnType<to>
  if (to === 'boolean')
    return bytesToBool(bytes, opts) as FromBytesReturnType<to>
  if (to === 'string')
    return bytesToString(bytes, opts) as FromBytesReturnType<to>
  return bytesToHex(bytes, opts) as FromBytesReturnType<to>
}

export type BytesToBigIntOpts = {
  /** Whether or not the number of a signed representation. */
  signed?: boolean | undefined
  /**
   * Upper bound (in bytes) on the input; a longer input throws
   * `SizeOverflowError`. Never a width to pad to — a shorter input decodes as
   * itself, exactly as `hexToBigInt` treats its `size`.
   */
  size?: number | undefined
}

export type BytesToBigIntErrorType =
  | BytesToHexErrorType
  | HexToBigIntErrorType
  | ErrorType

/**
 * Decodes a byte array into a bigint.
 *
 * @param bytes Byte array to decode.
 * @param opts Options.
 * @returns BigInt value.
 *
 * @example
 * import { bytesToBigInt } from '@tronweb3/tviem'
 * const data = bytesToBigInt(new Uint8Array([1, 164]))
 * // 420n
 *
 * @example
 * import { bytesToBigInt } from '@tronweb3/tviem'
 * const data = bytesToBigInt(new Uint8Array([1, 164]), { size: 4 })
 * // 420n — `size` bounds the input, it does not pad it
 */
export function bytesToBigInt(
  bytes: ByteArray,
  opts: BytesToBigIntOpts = {},
): bigint {
  if (typeof opts.size !== 'undefined') assertSize(bytes, { size: opts.size })
  // `size` is checked above and again by `hexToBigInt` as an upper bound; it
  // is NOT forwarded to `bytesToHex`, whose `size` right-pads to a fixed width
  // (bytes semantics). Padded, a short input read as a big-endian integer is
  // multiplied by 256^(size - length): `[1, 164]` at `size: 4` came back as
  // 27525120 rather than 420, and `[0xff]` at `size: 32, signed` as a huge
  // negative rather than -1n.
  const hex = bytesToHex(bytes)
  return hexToBigInt(hex, opts)
}

export type BytesToBoolOpts = {
  /** Size of the bytes. */
  size?: number | undefined
}

export type BytesToBoolErrorType =
  | AssertSizeErrorType
  | TrimErrorType
  | ErrorType

/**
 * Decodes a byte array into a boolean.
 *
 * @param bytes Byte array to decode.
 * @param opts Options.
 * @returns Boolean value.
 *
 * @example
 * import { bytesToBool } from '@tronweb3/tviem'
 * const data = bytesToBool(new Uint8Array([1]))
 * // true
 */
export function bytesToBool(
  bytes_: ByteArray,
  opts: BytesToBoolOpts = {},
): boolean {
  let bytes = bytes_
  if (typeof opts.size !== 'undefined') {
    assertSize(bytes, { size: opts.size })
    bytes = trim(bytes)
  }
  if (bytes.length > 1 || bytes[0]! > 1)
    throw new InvalidBytesBooleanError(bytes)
  return Boolean(bytes[0])
}

export type BytesToNumberOpts = BytesToBigIntOpts

export type BytesToNumberErrorType =
  | BytesToHexErrorType
  | HexToNumberErrorType
  | ErrorType

/**
 * Decodes a byte array into a number.
 *
 * @param bytes Byte array to decode.
 * @param opts Options.
 * @returns Number value.
 *
 * @example
 * import { bytesToNumber } from '@tronweb3/tviem'
 * const data = bytesToNumber(new Uint8Array([1, 164]))
 * // 420
 *
 * @example
 * import { bytesToNumber } from '@tronweb3/tviem'
 * const data = bytesToNumber(new Uint8Array([1, 164]), { size: 4 })
 * // 420 — `size` bounds the input, it does not pad it
 */
export function bytesToNumber(
  bytes: ByteArray,
  opts: BytesToNumberOpts = {},
): number {
  if (typeof opts.size !== 'undefined') assertSize(bytes, { size: opts.size })
  // See `bytesToBigInt`: `size` is a bound, never forwarded as a pad width.
  const hex = bytesToHex(bytes)
  return hexToNumber(hex, opts)
}

export type BytesToStringOpts = {
  /** Size of the bytes. */
  size?: number | undefined
}

export type BytesToStringErrorType =
  | AssertSizeErrorType
  | TrimErrorType
  | ErrorType

/**
 * Decodes a byte array into a UTF-8 string.
 *
 * @param bytes Byte array to decode.
 * @param opts Options.
 * @returns String value.
 *
 * @example
 * import { bytesToString } from '@tronweb3/tviem'
 * const data = bytesToString(new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33]))
 * // 'Hello world'
 */
export function bytesToString(
  bytes_: ByteArray,
  opts: BytesToStringOpts = {},
): string {
  let bytes = bytes_
  if (typeof opts.size !== 'undefined') {
    assertSize(bytes, { size: opts.size })
    bytes = trim(bytes, { dir: 'right' })
  }
  return new TextDecoder().decode(bytes)
}
