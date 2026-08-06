import { secp256k1 } from '@noble/curves/secp256k1'

import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Address, AddressInput } from '../../types/address.js'
import type { ByteArray, Hex, SignableMessage } from '../../types/misc.js'
import {
  type IsAddressEqualErrorType,
  isAddressEqual,
} from '../address/isAddressEqual.js'
import {
  type PublicKeyToAddressErrorType,
  publicKeyToAddress,
} from '../address/publicKeyToAddress.js'
import { type HashMessageErrorType, hashMessage } from './hashMessage.js'
import type { Signature } from './sign.js'

/** A signature accepted for recovery: a {@link Signature}, `0x`-prefixed or
 * bare wire-form hex (`r ++ s ++ v`, 130 chars), or a 65-byte array. */
export type SignatureInput = Signature | Hex | ByteArray | string

function toComponents(signature: SignatureInput): {
  r: bigint
  s: bigint
  recovery: number
} {
  if (typeof signature === 'object' && 'r' in signature) {
    const { r, s, v, recovery } = signature
    return {
      r: BigInt(r),
      s: BigInt(s),
      recovery: recovery ?? (v >= 27 ? v - 27 : v),
    }
  }
  const bytes =
    typeof signature === 'string'
      ? hexToWireBytes(signature)
      : (signature as ByteArray)
  if (bytes.length !== 65)
    throw new BaseError(
      `Invalid signature length: ${bytes.length} bytes. Expected 65 bytes (r ++ s ++ v).`,
    )
  const r = bytesToBigInt(bytes.subarray(0, 32))
  const s = bytesToBigInt(bytes.subarray(32, 64))
  const v = bytes[64] as number
  return { r, s, recovery: v >= 27 ? v - 27 : v }
}

function hexToWireBytes(hex: string): ByteArray {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++)
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

function bytesToBigInt(bytes: ByteArray): bigint {
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return BigInt(`0x${hex}`)
}

export type RecoverPublicKeyParameters = {
  /** The 32-byte digest that was signed (`0x`-prefixed hex or bytes). */
  hash: Hex | ByteArray
  /** The signature over `hash`. */
  signature: SignatureInput
}

export type RecoverPublicKeyReturnType = Hex

export type RecoverPublicKeyErrorType = BaseErrorType | ErrorType

/**
 * Recovers the uncompressed (65-byte, `0x04`-prefixed) secp256k1 public key
 * from a 32-byte digest and a signature.
 *
 * @returns The `0x`-prefixed 65-byte public key.
 */
export function recoverPublicKey({
  hash,
  signature,
}: RecoverPublicKeyParameters): RecoverPublicKeyReturnType {
  const { r, s, recovery } = toComponents(signature)
  const digest =
    typeof hash === 'string'
      ? hash.startsWith('0x')
        ? hash.slice(2)
        : hash
      : hash
  const point = new secp256k1.Signature(r, s)
    .addRecoveryBit(recovery)
    .recoverPublicKey(digest)
  return `0x${point.toHex(false)}` as Hex
}

export type RecoverMessageAddressParameters = {
  /** The message that was signed — a UTF-8 string or `{ raw }`. */
  message: SignableMessage
  /** The signature over the TIP-191 digest of `message`. */
  signature: SignatureInput
}

export type RecoverMessageAddressErrorType =
  | HashMessageErrorType
  | RecoverPublicKeyErrorType
  | PublicKeyToAddressErrorType
  | ErrorType

/**
 * Recovers the TRON Base58Check address that produced a TIP-191 message
 * signature.
 *
 * @param parameters The original `message` and its `signature`.
 * @returns The signer's Base58Check address (`T…`).
 *
 * @example
 * recoverMessageAddress({ message: 'hello @tronweb3/tviem', signature })
 * // 'T...'
 */
export function recoverMessageAddress({
  message,
  signature,
}: RecoverMessageAddressParameters): Address {
  const publicKey = recoverPublicKey({
    hash: hashMessage(message, 'bytes'),
    signature,
  })
  return publicKeyToAddress(publicKey)
}

export type VerifyMessageParameters = {
  /** The message that was signed — a UTF-8 string or `{ raw }`. */
  message: SignableMessage
  /** The signature over the TIP-191 digest of `message`. */
  signature: SignatureInput
  /** The address expected to have signed the message (any TRON form). */
  address: AddressInput
}

export type VerifyMessageErrorType =
  | RecoverMessageAddressErrorType
  | IsAddressEqualErrorType
  | ErrorType

/**
 * Verifies that `address` produced the TIP-191 signature over `message`.
 *
 * Recovers the signer with {@link recoverMessageAddress} and compares it to
 * `address` across all TRON address forms. Returns `false` (never throws) if
 * the signature is malformed or does not match.
 *
 * @returns `true` if the signature is valid for `address`, otherwise `false`.
 */
export function verifyMessage({
  message,
  signature,
  address,
}: VerifyMessageParameters): boolean {
  try {
    return isAddressEqual(
      recoverMessageAddress({ message, signature }),
      address,
    )
  } catch {
    return false
  }
}
