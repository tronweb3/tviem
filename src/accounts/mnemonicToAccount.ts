// TRON-specific, clean-room implementation for @tronweb3/omni.
import { HDKey } from '@scure/bip32'
import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'

import { BaseError, type BaseErrorType } from '../errors/base.js'
import type { ErrorType } from '../errors/utils.js'
import {
  type HDOptions,
  type HdKeyToAccountErrorType,
  hdKeyToAccount,
} from './hdKeyToAccount.js'
import type { TronHDAccount } from './types.js'

export type MnemonicToAccountOptions = HDOptions & {
  /** The BIP-39 passphrase (the optional "25th word"). @default '' */
  passphrase?: string | undefined
}

export type MnemonicToAccountErrorType =
  | HdKeyToAccountErrorType
  | BaseErrorType
  | ErrorType

/**
 * Derives a {@link TronHDAccount} from a BIP-39 mnemonic. The mnemonic is
 * validated against the English wordlist, expanded to a seed (with the optional
 * `passphrase`), and derived at the TRON path — default `m/44'/195'/0'/0/0`
 * (SLIP-44 coin type `195`). Signing is delegated to the derived private key.
 *
 * @param mnemonic A BIP-39 mnemonic phrase (English wordlist).
 * @param options `passphrase` plus HD derivation indices or an explicit `path`.
 * @returns A {@link TronHDAccount}.
 *
 * @example
 * const account = mnemonicToAccount(mnemonic)
 * account.address // 'T…' (m/44'/195'/0'/0/0)
 *
 * @example
 * // A different address index:
 * mnemonicToAccount(mnemonic, { addressIndex: 1 })
 */
export function mnemonicToAccount(
  mnemonic: string,
  { passphrase, ...hdOptions }: MnemonicToAccountOptions = {},
): TronHDAccount {
  if (!validateMnemonic(mnemonic, wordlist))
    throw new BaseError(
      'Invalid mnemonic: the phrase is not a valid BIP-39 English mnemonic.',
    )
  const seed = mnemonicToSeedSync(mnemonic, passphrase)
  return hdKeyToAccount(HDKey.fromMasterSeed(seed), hdOptions)
}
