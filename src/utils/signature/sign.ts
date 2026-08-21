import { secp256k1 } from '@noble/curves/secp256k1'

import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import { type HexToBytesErrorType, hexToBytes } from '../encoding/toBytes.js'

/** A secp256k1 signature in TRON wire form (`r(32) ++ s(32) ++ v(1)`). */
export type Signature = {
  /** `0x`-prefixed 32-byte `r` component. */
  r: Hex
  /** `0x`-prefixed 32-byte `s` component. */
  s: Hex
  /** Recovery id offset into the Ethereum range: `27 | 28`. */
  v: number
  /** Raw recovery id: `0 | 1`. */
  recovery: number
  /**
   * TRON `transaction.signature[]` form: bare lowercase hex
   * `r(32) ++ s(32) ++ v(1)` (130 chars, no `0x` prefix).
   */
  hex: string
  /** `0x`-prefixed `r(32) ++ s(32) ++ v(1)` (65 bytes). */
  serialized: Hex
}

export type SerializeSignatureErrorType = BaseErrorType | ErrorType

/** Exactly 32 bytes of hex, or a structured error naming the component. */
function componentHex(name: 'r' | 's', value: Hex): string {
  const clean = value.startsWith('0x') ? value.slice(2) : value
  if (!/^[0-9a-fA-F]{64}$/.test(clean))
    throw new BaseError(
      `Invalid signature ${name}: expected 32 bytes of hex, got "${value}".`,
    )
  return clean
}

/**
 * Serializes the `r`, `s` and `v` components into the `0x`-prefixed TRON wire
 * form `r(32) ++ s(32) ++ v(1)` (65 bytes). Each component is required in the
 * exact width the wire form carries — a shorter `r`/`s` is rejected rather
 * than zero-padded, since a short value cannot be told apart from a truncated
 * one.
 *
 * @param signature Signature components (`r`/`s` as `0x`-prefixed 32-byte hex,
 * `v` in `{27, 28}`).
 * @returns `0x`-prefixed 65-byte signature.
 */
export function serializeSignature({
  r,
  s,
  v,
}: {
  r: Hex
  s: Hex
  v: number
}): Hex {
  if (v !== 27 && v !== 28)
    throw new BaseError(`Invalid v: ${v}. Expected 27 or 28.`)
  return `0x${componentHex('r', r)}${componentHex('s', s)}${v.toString(16)}` as Hex
}

export type SignParameters = {
  /** The 32-byte digest to sign, as `0x`-prefixed hex or bytes. */
  hash: Hex | ByteArray
  /** The secp256k1 private key, as `0x`-prefixed or bare hex. */
  privateKey: Hex | string
  /**
   * Extra entropy for the (otherwise RFC 6979-deterministic) nonce. Pass `true`
   * for secure randomness, or explicit bytes/hex. Omit for a deterministic
   * signature (the TRON default).
   */
  extraEntropy?: Hex | ByteArray | boolean | undefined
}

export type SignErrorType = BaseErrorType | HexToBytesErrorType | ErrorType

/**
 * Signs a 32-byte digest with a secp256k1 private key, producing a TRON-form
 * signature (`r(32) ++ s(32) ++ v(1)`, `v ∈ {27, 28}`).
 *
 * The digest is signed as-is (never re-hashed); nonces are RFC 6979
 * deterministic with canonical low-`s`, matching TronWeb's `ECKeySign`.
 *
 * @param parameters Hash, private key and optional extra entropy.
 * @returns The signature, exposing `r`/`s`/`v`/`recovery`, the bare `hex` wire
 * form and the `0x`-prefixed `serialized` form.
 *
 * @example
 * sign({ hash: '0x407ec7...', privateKey: '0x00...01' }).hex
 * // '4d6f1e...ae001c'
 */
export function sign({
  hash,
  privateKey,
  extraEntropy,
}: SignParameters): Signature {
  const hashBytes = typeof hash === 'string' ? hexToBytes(hash) : hash
  if (hashBytes.length !== 32)
    throw new BaseError(
      `Invalid hash length: ${hashBytes.length} bytes. Expected a 32-byte digest.`,
    )

  const keyHex = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey

  // The advertised hex form is decoded here — noble rejects 0x-prefixed hex.
  const entropy =
    typeof extraEntropy === 'string' ? hexToBytes(extraEntropy) : extraEntropy

  const { r, s, recovery } = secp256k1.sign(
    hashBytes,
    keyHex,
    entropy !== undefined ? { extraEntropy: entropy } : {},
  )

  const v = recovery + 27
  const rHex = `0x${r.toString(16).padStart(64, '0')}` as Hex
  const sHex = `0x${s.toString(16).padStart(64, '0')}` as Hex
  const serialized = serializeSignature({ r: rHex, s: sHex, v })

  return {
    r: rHex,
    s: sHex,
    v,
    recovery,
    hex: serialized.slice(2),
    serialized,
  }
}
