import type { ErrorType } from '../../errors/utils.js'
import type { Address, AddressInput } from '../../types/address.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import {
  type EncodeBase58CheckErrorType,
  encodeBase58Check,
} from './base58check.js'
import {
  type NormalizeAddressErrorType,
  normalizeAddress,
} from './normalize.js'

export type ToBase58ErrorType =
  | NormalizeAddressErrorType
  | EncodeBase58CheckErrorType
  | ErrorType

/**
 * Converts any accepted address form (Base58Check / TRON hex / EVM hex /
 * bytes — see `normalizeAddress`) to the canonical Base58Check form (`T…`).
 *
 * Throws `InvalidAddressError` on invalid input.
 *
 * @example
 * toBase58('412b5ad5c4795c026514f8317c7a215e218dccd6cf')
 * // 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K'
 */
export function toBase58(address: AddressInput | ByteArray): Address {
  return encodeBase58Check(normalizeAddress(address)) as Address
}

export type HexToBase58ErrorType = ToBase58ErrorType | ErrorType

/**
 * ABI adapter (SEAM B): converts a 20-byte EVM hex address (`0x` + 40 hex
 * characters, e.g. sliced out of an ABI-decoded word) to the canonical
 * Base58Check form (`T…`).
 *
 * Throws `InvalidAddressError` on invalid input.
 *
 * @example
 * hexToBase58('0x0123456789abcdef0123456789abcdef01234567')
 * // 'TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe'
 */
export function hexToBase58(address: Hex): Address {
  return toBase58(address)
}
