// TRON-specific, clean-room implementation for @tronweb3/omni.
import { secp256k1 } from '@noble/curves/secp256k1'

import type { BaseErrorType } from '../errors/base.js'
import type { ErrorType } from '../errors/utils.js'
import type { Hex } from '../types/misc.js'
import {
  type BytesToHexErrorType,
  bytesToHex,
} from '../utils/encoding/toHex.js'
import {
  type Signature,
  type SignErrorType,
  sign,
} from '../utils/signature/sign.js'
import {
  type SignMessageErrorType,
  signMessage,
} from '../utils/signature/signMessage.js'
import type { SignableTransaction, TronLocalAccount } from './types.js'
import {
  type PrivateKeyToAddressErrorType,
  privateKeyToAddress,
} from './utils/privateKeyToAddress.js'
import {
  type SignTransactionErrorType,
  signTransaction,
} from './utils/signTransaction.js'

export type PrivateKeyToAccountErrorType =
  | PrivateKeyToAddressErrorType
  | BytesToHexErrorType
  | SignErrorType
  | SignMessageErrorType
  | SignTransactionErrorType
  | BaseErrorType
  | ErrorType

/**
 * Creates a local account from a secp256k1 private key. The returned account
 * derives its address and public key from the key, and signs digests,
 * messages (TIP-191) and transactions with it. Signing is synchronous.
 *
 * Accepts a `0x`-prefixed or bare hex key; the key is left-padded to 32 bytes
 * (TronWeb parity).
 *
 * @param privateKey The secp256k1 private key, as `0x`-prefixed or bare hex.
 * @returns A {@link TronLocalAccount}.
 *
 * @example
 * const account = privateKeyToAccount(
 *   '0x0000000000000000000000000000000000000000000000000000000000000001',
 * )
 * account.address // 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'
 */
export function privateKeyToAccount(
  privateKey: Hex | string,
): TronLocalAccount {
  const keyHex = (
    privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey
  ).padStart(64, '0')

  const address = privateKeyToAddress(keyHex)
  const publicKey = bytesToHex(secp256k1.getPublicKey(keyHex, false))

  return {
    address,
    publicKey,
    source: 'privateKey',
    type: 'local',
    sign: ({ hash }): Signature => sign({ hash, privateKey: keyHex }),
    signMessage: ({ message }): Signature =>
      signMessage({ message, privateKey: keyHex }),
    signTransaction: (transaction: SignableTransaction): SignableTransaction =>
      signTransaction({ transaction, privateKey: keyHex, address }),
  }
}
