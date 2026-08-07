import {
  InvalidHexValueError,
  type InvalidHexValueErrorType,
} from '../../errors/encoding.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Hex } from '../../types/misc.js'

export type IsHexErrorType = ErrorType

export function isHex(
  value: unknown,
  { strict = true }: { strict?: boolean | undefined } = {},
): value is Hex {
  if (!value) return false
  if (typeof value !== 'string') return false
  return strict ? /^0x[0-9a-fA-F]*$/.test(value) : value.startsWith('0x')
}

export type AssertHexBytesErrorType = InvalidHexValueErrorType | ErrorType

/**
 * Asserts that a hex value denotes a whole number of bytes.
 *
 * `isHex` accepts an odd nibble count and `size` rounds it up, so a value
 * like `0x123` slips past width checks and gets a nibble invented for it by
 * padding. Anywhere hex is treated as bytes, assert this first.
 */
export function assertHexBytes(value: Hex): void {
  if (value.length % 2 !== 0) throw new InvalidHexValueError(value)
}
