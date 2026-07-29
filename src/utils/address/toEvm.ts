import type { ErrorType } from '../../errors/utils.js'
import type { AddressInput, EvmAddress } from '../../types/address.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import { type BytesToHexErrorType, bytesToHex } from '../encoding/toHex.js'
import {
  type NormalizeAddressErrorType,
  normalizeAddress,
} from './normalize.js'

export type ToEvmErrorType =
  | NormalizeAddressErrorType
  | BytesToHexErrorType
  | ErrorType

/**
 * Converts any accepted address form (Base58Check / TRON hex / EVM hex /
 * bytes — see `normalizeAddress`) to the EVM hex form: `0x`-prefixed,
 * 40 lowercase hex characters (the `0x41` prefix byte stripped). This is
 * the form used at the TVM/ABI boundary and by EVM tooling bridges.
 *
 * Throws `InvalidAddressError` on invalid input.
 *
 * @example
 * toEvm('TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K')
 * // '0x2b5ad5c4795c026514f8317c7a215e218dccd6cf'
 */
export function toEvm(address: AddressInput | ByteArray): EvmAddress {
  return bytesToHex(normalizeAddress(address).subarray(1))
}

export type AddressToHexErrorType = ToEvmErrorType | ErrorType

/**
 * ABI adapter (SEAM A): converts any accepted address form to the 20-byte
 * `0x`-prefixed hex form, ready to be left-padded into a 32-byte ABI word.
 *
 * Throws `InvalidAddressError` on invalid input.
 *
 * @example
 * addressToHex('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')
 * // '0xa614f803b6fd780986a42c78ec9c7f77e6ded13c'
 */
export function addressToHex(address: AddressInput | ByteArray): Hex {
  return toEvm(address)
}
