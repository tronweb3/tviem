import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Address } from '../../types/address.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import { type HexToBytesErrorType, hexToBytes } from '../encoding/toBytes.js'
import { type Keccak256ErrorType, keccak256 } from '../hash/keccak256.js'
import {
  type EncodeBase58CheckErrorType,
  encodeBase58Check,
} from './base58check.js'

export type PublicKeyToAddressErrorType =
  | BaseErrorType
  | HexToBytesErrorType
  | Keccak256ErrorType
  | EncodeBase58CheckErrorType
  | ErrorType

/**
 * Converts an ECDSA (secp256k1) public key to its TRON Base58Check address:
 * `base58check(0x41 ++ keccak256(publicKey)[12..32])`.
 *
 * Accepts a 65-byte uncompressed public key (`0x04` prefix) or its 64-byte
 * body, as `0x`-prefixed hex or bytes.
 *
 * @example
 * publicKeyToAddress('0x04...')
 * // 'T...' — the address that public key controls
 */
export function publicKeyToAddress(publicKey: Hex | ByteArray): Address {
  const bytes =
    typeof publicKey === 'string' ? hexToBytes(publicKey) : publicKey
  const body = (() => {
    if (bytes.length === 65) {
      if (bytes[0] !== 0x04)
        throw new BaseError(
          'Invalid public key: a 65-byte uncompressed public key must start with the `0x04` prefix byte.',
        )
      return bytes.subarray(1)
    }
    if (bytes.length === 64) return bytes
    throw new BaseError(
      `Invalid public key length: ${bytes.length} bytes. Expected a 65-byte uncompressed ("04"-prefixed) public key, or its 64-byte body.`,
    )
  })()
  const hash = keccak256(body, 'bytes')
  const payload = new Uint8Array(21)
  payload[0] = 0x41
  payload.set(hash.subarray(12), 1)
  return encodeBase58Check(payload) as Address
}
