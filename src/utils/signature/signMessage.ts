// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { ErrorType } from '../../errors/utils.js'
import type { ByteArray, Hex, SignableMessage } from '../../types/misc.js'
import { type HashMessageErrorType, hashMessage } from './hashMessage.js'
import { type Signature, type SignErrorType, sign } from './sign.js'

export type SignMessageParameters = {
  /** The message to sign — a UTF-8 string or `{ raw: Hex | bytes }`. */
  message: SignableMessage
  /** The secp256k1 private key, as `0x`-prefixed or bare hex. */
  privateKey: Hex | string
  /**
   * Extra entropy for the (otherwise RFC 6979-deterministic) nonce. Omit for a
   * deterministic signature (the TRON default).
   */
  extraEntropy?: Hex | ByteArray | boolean | undefined
}

export type SignMessageErrorType =
  | HashMessageErrorType
  | SignErrorType
  | ErrorType

/**
 * Signs a message according to TIP-191: hashes it with {@link hashMessage},
 * then signs the digest with the secp256k1 private key.
 *
 * @param parameters Message, private key and optional extra entropy.
 * @returns The signature (TRON wire form), exposing `r`/`s`/`v`/`recovery`,
 * the bare `hex` form and the `0x`-prefixed `serialized` form.
 *
 * @example
 * signMessage({ message: 'hello @tronweb3/omni', privateKey: '0x00...01' })
 *   .serialized
 * // '0x855e95...135dea1b'
 */
export function signMessage({
  message,
  privateKey,
  extraEntropy,
}: SignMessageParameters): Signature {
  return sign({
    hash: hashMessage(message),
    privateKey,
    ...(extraEntropy !== undefined ? { extraEntropy } : {}),
  })
}
