import type { ErrorType } from '../../errors/utils.js'
import type { AddressInput } from '../../types/address.js'
import {
  type NormalizeAddressErrorType,
  normalizeAddress,
} from './normalize.js'

export type IsAddressEqualErrorType = NormalizeAddressErrorType | ErrorType

/**
 * Checks if two addresses are equal, across forms: each side may be
 * Base58Check (`T…`), TRON hex (`41…`, with or without `0x`), or 20-byte
 * EVM hex (`0x…`) — both are normalized to the 21-byte pivot and compared
 * byte-for-byte.
 *
 * Throws `InvalidAddressError` if either input is not a valid address.
 *
 * @example
 * isAddressEqual(
 *   'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
 *   '0x2b5ad5c4795c026514f8317c7a215e218dccd6cf',
 * ) // true
 */
export function isAddressEqual(a: AddressInput, b: AddressInput): boolean {
  const aBytes = normalizeAddress(a)
  const bBytes = normalizeAddress(b)
  for (let i = 0; i < aBytes.length; i++)
    if (aBytes[i] !== bBytes[i]) return false
  return true
}
