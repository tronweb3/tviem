import { generateMnemonic as generateMnemonic_ } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'

import type { ErrorType } from '../errors/utils.js'

export type GenerateMnemonicErrorType = ErrorType

/**
 * Generates a random BIP-39 mnemonic from the English wordlist. Pair with
 * {@link mnemonicToAccount} to create a fresh HD account.
 *
 * @param strength Entropy in bits (must be a multiple of 32). @default 128
 * (a 12-word phrase; pass `256` for 24 words).
 * @returns A space-separated mnemonic phrase.
 */
export function generateMnemonic(strength = 128): string {
  return generateMnemonic_(wordlist, strength)
}
