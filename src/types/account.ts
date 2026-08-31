import {
  type PrivateKeyToAccountErrorType,
  privateKeyToAccount,
} from '../accounts/privateKeyToAccount.js'
import type {
  AccountKey,
  TronAccount,
  TronLocalAccount,
} from '../accounts/types.js'
import type { ErrorType } from '../errors/utils.js'

/**
 * Resolves an `account` source to its concrete account type. In v0.1b the only
 * string source is a private key, so any string — an {@link AccountKey},
 * `0x`-prefixed or bare hex — resolves to a {@link TronLocalAccount}; an
 * already-built account passes through unchanged.
 *
 * Base58-address-only (watch-only) sources are reserved for v0.1c.
 */
export type ParseAccount<accountOrKey> = accountOrKey extends string
  ? TronLocalAccount
  : accountOrKey

// A key source is resolved through privateKeyToAccount — fold its surface.
export type ParseAccountErrorType = PrivateKeyToAccountErrorType | ErrorType

/**
 * Normalizes an `account` source into a {@link TronAccount}.
 *
 * - An {@link AccountKey} (private key, `0x`-prefixed or bare hex) is turned
 *   into a local account via {@link privateKeyToAccount}.
 * - An already-built account is returned as-is.
 */
export function parseAccount<source extends TronAccount | AccountKey>(
  source: source,
): ParseAccount<source> {
  if (typeof source === 'string')
    return privateKeyToAccount(source) as ParseAccount<source>
  return source as ParseAccount<source>
}
