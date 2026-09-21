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
 *   remote signers plug into. The source may be a plain object or a class
 *   instance: its methods are bound to it, so ones defined on a prototype
 *   keep their `this`. Only the {@link TronCustomSource} members are carried
 *   over — anything else the source holds stays on the source.
 *
 * @param source A hex private key, or a {@link TronCustomSource}.
 * @returns The completed account.
 *
 * @example
 * // From a private key:
 * toAccount('0x...').address // 'T...'
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

  // Read `address` once and pin that value into the account, so the account
  // can never carry an address the type check did not see.
  const address = source?.address
  if (!source || typeof address !== 'string')
    throw new BaseError(
      'Invalid account source: expected a hex private key or a custom source with an `address`.',
    )

  // The account surface is listed member by member rather than spread from
  // the source. A spread copies own enumerable properties only, so a class
  // instance — state on the instance, signing methods on its prototype —
  // would come out with no signing methods at all; it would also carry along
  // whatever else the source holds (a key, a transport) into an object that
  // gets passed around as "the account". Each member is read exactly once.
  const multiSign = bindTo(source, source.multiSign)
  return {
    address,
    publicKey: source.publicKey,
    signMessage: bindTo(source, source.signMessage),
    signTypedData: bindTo(source, source.signTypedData),
    signTransaction: bindTo(source, source.signTransaction),
    ...(multiSign !== undefined ? { multiSign } : {}),
    source: 'custom',
    type: 'local',
  }
}

/**
 * Binds a source's method to the source, so a prototype method still reaches
 * its instance state through `this` once it is called as `account.method()`.
 * A no-op for closures and arrow functions. A non-function is passed through
 * untouched: a missing member fails where it is called, as it always has.
 */
function bindTo<member>(source: TronCustomSource, member: member): member {
  return typeof member === 'function' ? member.bind(source) : member
}
