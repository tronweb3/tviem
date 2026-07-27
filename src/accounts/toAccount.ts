// TRON-specific, clean-room implementation for @tronweb3/omni.
import { BaseError, type BaseErrorType } from '../errors/base.js'
import type { ErrorType } from '../errors/utils.js'
import type { Hex } from '../types/misc.js'
import {
  type PrivateKeyToAccountErrorType,
  privateKeyToAccount,
} from './privateKeyToAccount.js'
import type {
  TronCustomAccount,
  TronCustomSource,
  TronLocalAccount,
} from './types.js'

export type ToAccountErrorType =
  | PrivateKeyToAccountErrorType
  | BaseErrorType
  | ErrorType

/**
 * Creates an account from a private key or a caller-supplied signing source.
 *
 * - Passing a `0x`-prefixed or bare hex **private key** delegates to
 *   {@link privateKeyToAccount}, yielding a {@link TronLocalAccount}.
 * - Passing a **custom source** (an object carrying an `address` plus its own
 *   `signMessage`/`signTypedData`/`signTransaction` functions) completes it into a
 *   {@link TronCustomAccount} by attaching the `source: 'custom'` /
 *   `type: 'local'` discriminants. This is the shape v0.1c delegated and
 *   remote signers plug into.
 *
 * @param source A hex private key, or a {@link TronCustomSource}.
 * @returns The completed account.
 *
 * @example
 * // From a private key:
 * toAccount('0x00…01').address // 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'
 *
 * @example
 * // From a custom source:
 * toAccount({ address, publicKey, signMessage, signTypedData, signTransaction })
 */
export function toAccount(source: Hex | string): TronLocalAccount
export function toAccount(source: TronCustomSource): TronCustomAccount
export function toAccount(
  source: Hex | string | TronCustomSource,
): TronLocalAccount | TronCustomAccount {
  if (typeof source === 'string') return privateKeyToAccount(source)

  if (!source || typeof source.address !== 'string')
    throw new BaseError(
      'Invalid account source: expected a hex private key or a custom source with an `address`.',
    )

  return { ...source, source: 'custom', type: 'local' }
}
