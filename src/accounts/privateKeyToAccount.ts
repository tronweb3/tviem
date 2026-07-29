// TRON-specific, clean-room implementation for @tronweb3/tviem.
import { secp256k1 } from '@noble/curves/secp256k1'

import type { BaseErrorType } from '../errors/base.js'
import type { ErrorType } from '../errors/utils.js'
import type { Hex } from '../types/misc.js'
import {
  type BytesToHexErrorType,
  bytesToHex,
} from '../utils/encoding/toHex.js'
import type { Signature } from '../utils/signature/sign.js'
import {
  type SignMessageErrorType,
  signMessage,
} from '../utils/signature/signMessage.js'
import {
  type SignTypedDataErrorType,
  signTypedData,
} from '../utils/signature/signTypedData.js'
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
  | SignMessageErrorType
  | SignTypedDataErrorType
  | SignTransactionErrorType
  | BaseErrorType
  | ErrorType

/**
 * Creates a local account from a secp256k1 private key. The returned account
 * derives its address and public key from the key, and signs messages
 * (TIP-191), typed data (TIP-712) and transactions with it. Signing is
 * synchronous. There is deliberately no raw-digest `sign` — blind signing is
 * not supported (see {@link TronCustomSource}).
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
    signMessage: ({ message }): Signature =>
      signMessage({ message, privateKey: keyHex }),
    signTypedData: (parameters): Signature =>
      signTypedData({ ...parameters, privateKey: keyHex }),
    signTransaction: (transaction: SignableTransaction): SignableTransaction =>
      signTransaction({ transaction, privateKey: keyHex, address }),
  }
}
