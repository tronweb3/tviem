import { BaseError } from '../../errors/base.js'

/** JS `MAX_SAFE_INTEGER` as a bigint bound for int64 → JSON. */
const maxSafe = 9007199254740991n

/**
 * Encodes an `int64` for the canonical JSON model: a JSON number when within
 * `±(2^53 − 1)`, else a decimal string (lossless where java-tron's own
 * unquoted rendering would overflow JS).
 */
export function int64ToJson(value: bigint | number): number | string {
  const v = BigInt(value)
  return v >= -maxSafe && v <= maxSafe ? Number(v) : v.toString()
}

/**
 * Parses an encode-side `Int64` input (`bigint | number | string`) to bigint,
 * refusing values that cannot round-trip:
 *
 * - a `number` must be a safe integer — IEEE-754 has already rounded anything
 *   past `2^53`, so `BigInt()` would faithfully convert a value the caller
 *   never wrote (and a fraction would escape as a raw `RangeError`);
 * - a `string` must be a plain decimal integer — anything else would escape
 *   `BigInt()` as a raw `SyntaxError`.
 *
 * @param name Field name for the error message.
 * @param value The caller's input.
 * @returns The exact value as a bigint.
 */
export function int64InputToBigInt(
  name: string,
  value: bigint | number | string,
): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value))
      throw new BaseError(
        `Invalid ${name}: ${value} is not a safe integer. Pass a bigint (or decimal string) for values past 2^53.`,
      )
    return BigInt(value)
  }
  if (!/^-?\d+$/.test(value))
    throw new BaseError(
      `Invalid ${name}: "${value}" is not a decimal integer string.`,
    )
  return BigInt(value)
}
