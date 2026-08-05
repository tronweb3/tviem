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
 * Accepts a 32-byte private key as `0x`-prefixed or bare hex; the uncompressed
 * public key is derived and hashed (`keccak256`, last 20 bytes, `0x41` prefix).
 * The key must be a full 32 bytes — a short or malformed key is rejected by the
 * secp256k1 layer, never silently zero-padded (the caller guarantees the key).
 */
export function privateKeyToAddress(privateKey: Hex | string): Address {
  const hex = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey
  const publicKey = secp256k1.getPublicKey(hex, false)
  return publicKeyToAddress(publicKey)
}
