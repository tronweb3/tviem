import type { ErrorType } from '../../errors/utils.js'
import type { ByteArray } from '../../types/misc.js'
import { type BytesToHexErrorType, bytesToHex } from './toHex.js'

export type BareHexErrorType = BytesToHexErrorType | ErrorType

/**
 * Normalizes bytes or a hex string to bare lowercase hex (no `0x` prefix) —
 * the form TRON's JSON surfaces carry (`raw_data_hex`, `txID`, byte fields
 * of the canonical transaction model).
 *
 * @param value Bytes, or hex (bare or `0x`-prefixed, any case).
 * @returns Bare lowercase hex.
 */
export function bareHex(value: ByteArray | string): string {
  if (typeof value === 'string')
    return (value.startsWith('0x') ? value.slice(2) : value).toLowerCase()
  return bytesToHex(value).slice(2)
}
