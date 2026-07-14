// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { HDKey } from '@scure/bip32'

import { BaseError, type BaseErrorType } from '../errors/base.js'
import type { ErrorType } from '../errors/utils.js'
import {
  type BytesToHexErrorType,
  bytesToHex,
} from '../utils/encoding/toHex.js'
import {
  type PrivateKeyToAccountErrorType,
  privateKeyToAccount,
} from './privateKeyToAccount.js'
import type { TronHDAccount } from './types.js'

/**
 * HD derivation options. Either provide the individual BIP-44 indices (each
 * defaulting to `0`, producing `m/44'/195'/0'/0/0`) **or** an explicit `path`
 * that overrides them — not both. TRON's SLIP-44 coin type is `195`.
 */
export type HDOptions =
  | {
      /** The account index (the hardened `account'` segment). @default 0 */
      accountIndex?: number | undefined
      /** The address index (the final segment). @default 0 */
      addressIndex?: number | undefined
      /** The change index (the `change` segment). @default 0 */
      changeIndex?: number | undefined
      path?: undefined
    }
  | {
      accountIndex?: undefined
      addressIndex?: undefined
      changeIndex?: undefined
      /** The full BIP-44 derivation path (overrides the index options). */
      path: `m/44'/195'/${string}`
    }

export type HdKeyToAccountErrorType =
  | PrivateKeyToAccountErrorType
  | BytesToHexErrorType
  | BaseErrorType
  | ErrorType

/**
 * Derives a {@link TronHDAccount} from a BIP-32 HD node. Derives the node at
 * the TRON path (default `m/44'/195'/0'/0/0`), then builds a local account
 * from the derived private key — so it signs identically to
 * {@link privateKeyToAccount}. `getHdKey` returns the derived node.
 *
 * @param hdKey A `@scure/bip32` HD node (typically a master key).
 * @param options HD derivation indices or an explicit `path`.
 * @returns A {@link TronHDAccount}.
 */
export function hdKeyToAccount(
  hdKey: HDKey,
  { accountIndex = 0, addressIndex = 0, changeIndex = 0, path }: HDOptions = {},
): TronHDAccount {
  const derived = hdKey.derive(
    path ?? `m/44'/195'/${accountIndex}'/${changeIndex}/${addressIndex}`,
  )
  if (!derived.privateKey)
    throw new BaseError(
      'The derived HD node has no private key (a public-only node cannot sign).',
    )

  const account = privateKeyToAccount(bytesToHex(derived.privateKey))
  return {
    ...account,
    source: 'hd',
    getHdKey: () => derived,
  }
}
