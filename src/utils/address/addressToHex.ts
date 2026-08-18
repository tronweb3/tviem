import type { ErrorType } from '../../errors/utils.js'
import type { AddressInput, TronHexAddress } from '../../types/address.js'
import type { ByteArray } from '../../types/misc.js'
import { type BytesToHexErrorType, bytesToHex } from '../encoding/toHex.js'
import {
  type NormalizeAddressErrorType,
  normalizeAddress,
} from './normalize.js'

export type AddressToHexErrorType =
  | NormalizeAddressErrorType
  | BytesToHexErrorType
  | ErrorType

/**
 * Converts any accepted address form (Base58Check / TRON hex / EVM hex /
 * bytes — see `normalizeAddress`) to the TRON hex form: `41`-prefixed,
 * 42 lowercase hex characters, without a `0x` prefix (the form used on the
 * protobuf wire and by TRON node APIs).
 *
 * Throws `InvalidAddressError` on invalid input.
 *
 * @example
 * addressToHex('T...')
 * // '41...' — the same address in TRON hex form
 */
export function addressToHex(
  address: AddressInput | ByteArray,
): TronHexAddress {
  return bytesToHex(normalizeAddress(address)).slice(2) as TronHexAddress
}
