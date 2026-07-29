import { sha256 } from '@noble/hashes/sha256'
import { base58 } from '@scure/base'

import {
  InvalidAddressError,
  type InvalidAddressErrorType,
} from '../../errors/address.js'
import type { ErrorType } from '../../errors/utils.js'
import type { ByteArray } from '../../types/misc.js'

/**
 * Computes the Base58Check checksum of a payload: the first 4 bytes of
 * `sha256(sha256(payload))`.
 */
function checksum(payload: ByteArray): ByteArray {
  return sha256(sha256(payload)).slice(0, 4)
}

export type EncodeBase58CheckErrorType = ErrorType

/**
 * Encodes a byte payload into a Base58Check string:
 * `base58(payload ++ sha256(sha256(payload))[0..4])`.
 *
 * For TRON addresses the payload is the 21-byte pivot
 * (`0x41` prefix ++ 20-byte account id), producing a `T…` string.
 *
 * @example
 * encodeBase58Check(hexToBytes('0x412b5ad5c4795c026514f8317c7a215e218dccd6cf'))
 * // 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K'
 */
export function encodeBase58Check(payload: ByteArray): string {
  const bytes = new Uint8Array(payload.length + 4)
  bytes.set(payload)
  bytes.set(checksum(payload), payload.length)
  return base58.encode(bytes)
}

export type DecodeBase58CheckErrorType =
  | InvalidAddressErrorType
  | TryDecodeBase58CheckErrorType
  | ErrorType

/**
 * Decodes a Base58Check string back into its byte payload, verifying the
 * 4-byte double-SHA256 checksum. Throws `InvalidAddressError` if the value
 * is not valid Base58, is too short, or fails the checksum.
 */
export function decodeBase58Check(value: string): ByteArray {
  const payload = tryDecodeBase58Check(value)
  if (payload === null) throw new InvalidAddressError({ address: value })
  return payload
}

export type TryDecodeBase58CheckErrorType = ErrorType

/**
 * Decodes a Base58Check string back into its byte payload, verifying the
 * 4-byte double-SHA256 checksum. Returns `null` (never throws) on any
 * malformed input.
 */
export function tryDecodeBase58Check(value: string): ByteArray | null {
  if (typeof value !== 'string' || value.length === 0) return null
  let decoded: ByteArray
  try {
    decoded = base58.decode(value)
  } catch {
    return null
  }
  // Require at least 1 payload byte + 4 checksum bytes.
  if (decoded.length <= 4) return null
  const payload = decoded.slice(0, -4)
  const check = decoded.slice(-4)
  const expected = checksum(payload)
  if (
    check[0] !== expected[0] ||
    check[1] !== expected[1] ||
    check[2] !== expected[2] ||
    check[3] !== expected[3]
  )
    return null
  return payload
}
