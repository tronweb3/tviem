// TRON-specific, clean-room implementation for @tronweb3/tviem.
import type { ErrorType } from '../../errors/utils.js'
import type { Address, AddressInput } from '../../types/address.js'
import { tryDecodeBase58Check } from './base58check.js'
import { normalizeAddress } from './normalize.js'

export type IsAddressOptions = {
  /**
   * Only accept the canonical Base58Check form (`T…`, 34 characters).
   *
   * When `false`, any form `normalizeAddress` accepts also passes:
   * TRON hex (`41…`, with or without `0x`) and 20-byte EVM hex (`0x…`).
   *
   * @default true
   */
  strict?: boolean | undefined
}

export type IsAddressErrorType = ErrorType

/**
 * Checks if the given string is a valid TRON address. Never throws — any
 * malformed or non-string input returns `false`.
 *
 * By default (`strict: true`) only the canonical Base58Check form passes,
 * via 4 checks:
 * 1. shape: `T`-prefixed, 34 characters,
 * 2. Base58-decodable,
 * 3. decodes to a 21-byte, `0x41`-prefixed payload,
 * 4. double-SHA256 checksum matches.
 *
 * @example
 * isAddress('TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K') // true
 * isAddress('0x2b5ad5c4795c026514f8317c7a215e218dccd6cf') // false
 * isAddress('0x2b5ad5c4795c026514f8317c7a215e218dccd6cf', { strict: false }) // true
 */
export function isAddress(
  address: string,
  options?: IsAddressOptions | undefined,
): address is Address {
  const { strict = true } = options ?? {}
  if (typeof address !== 'string') return false
  if (strict) {
    // 1. shape
    if (address.length !== 34 || !address.startsWith('T')) return false
    // 2.–4. base58-decodable + checksum (`tryDecodeBase58Check`) + 21-byte
    // `0x41`-prefixed payload
    const payload = tryDecodeBase58Check(address)
    return payload !== null && payload.length === 21 && payload[0] === 0x41
  }
  try {
    normalizeAddress(address as AddressInput)
    return true
  } catch {
    return false
  }
}
