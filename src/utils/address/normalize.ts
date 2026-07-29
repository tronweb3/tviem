// TRON-specific, clean-room implementation for @tronweb3/tviem.
import {
  InvalidAddressError,
  type InvalidAddressErrorType,
} from '../../errors/address.js'
import type { ErrorType } from '../../errors/utils.js'
import type { AddressInput } from '../../types/address.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import { type HexToBytesErrorType, hexToBytes } from '../encoding/toBytes.js'
import { bytesToHex } from '../encoding/toHex.js'
import { tryDecodeBase58Check } from './base58check.js'

/** `0x41` — the TRON address version/prefix byte. */
const addressPrefixByte = 0x41

const bareHexRegex = /^[0-9a-fA-F]*$/

export type NormalizeAddressErrorType =
  | InvalidAddressErrorType
  | HexToBytesErrorType
  | ErrorType

/**
 * Normalizes any accepted address form to the 21-byte pivot
 * (`0x41` prefix ++ 20-byte account id), the single source of truth all
 * other conversions are derived from.
 *
 * Accepted forms (wide-in):
 * - Base58Check: `T…` (34 characters, checksum-verified).
 * - TRON hex: `41…` (21 bytes / 42 hex characters), with or without `0x`.
 * - EVM hex: `0x…` (20 bytes / 40 hex characters).
 * - `Uint8Array`: 21 bytes (`0x41`-prefixed) or a bare 20-byte account id.
 *
 * Throws `InvalidAddressError` on anything else. Always returns a fresh
 * `Uint8Array` (callers may mutate it freely).
 */
export function normalizeAddress(address: AddressInput | ByteArray): ByteArray {
  const bytes = tryNormalizeAddress(address)
  if (bytes === null)
    throw new InvalidAddressError({
      address:
        address instanceof Uint8Array ? bytesToHex(address) : String(address),
    })
  return bytes
}

/** Internal wide-in parser: returns the 21-byte pivot, or `null` if invalid. */
function tryNormalizeAddress(
  address: AddressInput | ByteArray,
): ByteArray | null {
  if (address instanceof Uint8Array) {
    if (address.length === 21 && address[0] === addressPrefixByte)
      return Uint8Array.from(address)
    if (address.length === 20) {
      const bytes = new Uint8Array(21)
      bytes[0] = addressPrefixByte
      bytes.set(address, 1)
      return bytes
    }
    return null
  }
  if (typeof address !== 'string') return null
  // Base58Check form (`T…`).
  if (address.startsWith('T')) {
    if (address.length !== 34) return null
    const decoded = tryDecodeBase58Check(address)
    if (
      decoded === null ||
      decoded.length !== 21 ||
      decoded[0] !== addressPrefixByte
    )
      return null
    return decoded
  }
  // Hex forms.
  const has0x = address.startsWith('0x')
  const hex = has0x ? address.slice(2) : address
  if (!bareHexRegex.test(hex)) return null
  // TRON hex form (`41…`, 21 bytes), with or without `0x`.
  if (hex.length === 42 && hex.startsWith('41'))
    return hexToBytes(`0x${hex}` as Hex)
  // EVM hex form (`0x…`, 20 bytes) — requires the `0x` prefix.
  if (has0x && hex.length === 40) {
    const bytes = new Uint8Array(21)
    bytes[0] = addressPrefixByte
    bytes.set(hexToBytes(`0x${hex}` as Hex), 1)
    return bytes
  }
  return null
}
