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
