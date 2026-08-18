import type { ErrorType } from '../../errors/utils.js'
import type { AddressInput, EvmAddress } from '../../types/address.js'
import type { ByteArray } from '../../types/misc.js'
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
 * the form used at the TVM/ABI boundary and by EVM tooling bridges — the
 * ABI adapter (SEAM A), ready to be left-padded into a 32-byte ABI word.
 *
 * Throws `InvalidAddressError` on invalid input.
 *
 * @example
 * toEvm('T...')
 * // '0x...' — the same address, 20-byte body without the `0x41` prefix
 */
export function toEvm(address: AddressInput | ByteArray): EvmAddress {
  return bytesToHex(normalizeAddress(address).subarray(1))
}
