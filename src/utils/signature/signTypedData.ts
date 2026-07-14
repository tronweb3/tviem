// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { ErrorType } from '../../errors/utils.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import {
  type HashTypedDataErrorType,
  type HashTypedDataParameters,
  hashTypedData,
} from './hashTypedData.js'
import { type Signature, type SignErrorType, sign } from './sign.js'

export type SignTypedDataParameters = HashTypedDataParameters & {
  /** The secp256k1 private key, as `0x`-prefixed or bare hex. */
  privateKey: Hex | string
  /**
   * Extra entropy for the (otherwise RFC 6979-deterministic) nonce. Omit for a
   * deterministic signature (the TRON default).
   */
  extraEntropy?: Hex | ByteArray | boolean | undefined
}

export type SignTypedDataErrorType =
  | HashTypedDataErrorType
  | SignErrorType
  | ErrorType

/**
 * Signs TIP-712 (EIP-712) typed structured data: hashes it with
 * {@link hashTypedData}, then signs the digest with the secp256k1 private key.
 *
 * TRON-specific: `address`-typed values (message fields and
 * `domain.verifyingContract`) accept any TRON address form and are encoded as
 * their 20-byte EVM form; `trcToken` is treated as `uint256`.
 *
 * @param parameters `domain`, `types`, `primaryType`, `message`, the private
 * key and optional extra entropy.
 * @returns The signature (TRON wire form), exposing `r`/`s`/`v`/`recovery`,
 * the bare `hex` form and the `0x`-prefixed `serialized` form.
 *
 * @example
 * signTypedData({ domain, types, primaryType: 'Mail', message, privateKey })
 *   .serialized
 */
export function signTypedData({
  privateKey,
  extraEntropy,
  ...typedData
}: SignTypedDataParameters): Signature {
  return sign({
    hash: hashTypedData(typedData),
    privateKey,
    ...(extraEntropy !== undefined ? { extraEntropy } : {}),
  })
}
