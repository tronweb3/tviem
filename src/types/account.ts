// TRON-specific, clean-room implementation for @tronweb3/omni.
import { privateKeyToAccount } from '../accounts/privateKeyToAccount.js'
import type { TronAccount, TronLocalAccount } from '../accounts/types.js'
import type { ErrorType } from '../errors/utils.js'
import type { Hex } from './misc.js'

/**
 * Resolves an `account` source to its concrete account type. In v0.1b the only
 * string source is a private key, so a {@link Hex} resolves to a
 * {@link TronLocalAccount}; an already-built account passes through unchanged.
 *
 * Base58-address-only (watch-only) sources are reserved for v0.1c.
 */
export type ParseAccount<accountOrAddress> = accountOrAddress extends Hex
  ? TronLocalAccount
  : accountOrAddress

export type ParseAccountErrorType = ErrorType

/**
 * Normalizes an `account` source into a {@link TronAccount}.
 *
 * - A `string` (private key, `0x`-prefixed or bare hex) is turned into a local
 *   account via {@link privateKeyToAccount}.
 * - An already-built account is returned as-is.
 */
export function parseAccount<source extends TronAccount | Hex>(
  source: source,
): ParseAccount<source> {
  if (typeof source === 'string')
    return privateKeyToAccount(source) as ParseAccount<source>
  return source as ParseAccount<source>
}
