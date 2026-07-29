// TRON-specific, clean-room implementation for @tronweb3/tviem.
import { secp256k1 } from '@noble/curves/secp256k1'

import type { ErrorType } from '../errors/utils.js'
import type { Hex } from '../types/misc.js'
import {
  type BytesToHexErrorType,
  bytesToHex,
} from '../utils/encoding/toHex.js'

export type GeneratePrivateKeyErrorType = BytesToHexErrorType | ErrorType

/**
 * Generates a cryptographically-random secp256k1 private key using the
 * platform CSPRNG. The result is always a valid curve scalar (`1 ≤ k < n`).
 *
 * @returns A `0x`-prefixed 32-byte (64 hex char) private key.
 *
 * @example
 * const privateKey = generatePrivateKey()
 * // '0x…' (66 chars)
 */
export function generatePrivateKey(): Hex {
  return bytesToHex(secp256k1.utils.randomPrivateKey())
}
