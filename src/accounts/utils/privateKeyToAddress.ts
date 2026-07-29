import { secp256k1 } from '@noble/curves/secp256k1'

import type { ErrorType } from '../../errors/utils.js'
import type { Address } from '../../types/address.js'
import type { Hex } from '../../types/misc.js'
import {
  type PublicKeyToAddressErrorType,
  publicKeyToAddress,
} from '../../utils/address/publicKeyToAddress.js'

export type PrivateKeyToAddressErrorType =
  | PublicKeyToAddressErrorType
  | ErrorType

/**
 * Converts an ECDSA (secp256k1) private key to its TRON Base58Check address.
 *
 * Accepts `0x`-prefixed or bare hex; the key is left-padded to 32 bytes
 * (TronWeb `pkToAddress` parity), then the uncompressed public key is
 * derived and hashed (`keccak256`, last 20 bytes, `0x41` prefix).
 *
 * @example
 * privateKeyToAddress('0x0000000000000000000000000000000000000000000000000000000000000002')
 * // 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K'
 */
export function privateKeyToAddress(privateKey: Hex | string): Address {
  const hex = (
    privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey
  ).padStart(64, '0')
  const publicKey = secp256k1.getPublicKey(hex, false)
  return publicKeyToAddress(publicKey)
}
