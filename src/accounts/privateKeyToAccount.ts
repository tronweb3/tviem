import { secp256k1 } from '@noble/curves/secp256k1'

import { BaseError, type BaseErrorType } from '../errors/base.js'
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
import type {
  AccountMultiSignOptions,
  SignableTransaction,
  TronLocalAccount,
} from './types.js'
import {
  type MultiSignTransactionErrorType,
  multiSignTransaction,
} from './utils/multiSignTransaction.js'
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
  | MultiSignTransactionErrorType
  | BaseErrorType
  | ErrorType

/**
 * Creates a local account from a secp256k1 private key. The returned account
 * derives its address and public key from the key, and signs messages
 * (TIP-191), typed data (TIP-712) and transactions with it; `multiSign`
 * co-signs multi-signature transactions under a permission id. Signing is
 * synchronous. `signTransaction` only signs unsigned transactions — one that
 * already carries a signature (its own or a foreign one) is refused, since
 * collecting signatures is `multiSign`'s business. There is deliberately no
 * raw-digest `sign` — blind signing is not supported (see
 * {@link TronCustomSource}).
 *
 * Accepts a 32-byte private key as `0x`-prefixed or bare hex. The key must be a
 * full 32 bytes — a short or malformed key is rejected by the secp256k1 layer,
 * never silently zero-padded (the caller guarantees the key).
 *
 * @param privateKey The secp256k1 private key, as `0x`-prefixed or bare hex.
 * @returns A {@link TronLocalAccount}.
 *
 * @example
 * const account = privateKeyToAccount(
 *   '0x...',
 * )
 * account.address // 'T...'
 */
export function privateKeyToAccount(
  privateKey: Hex | string,
): TronLocalAccount {
  const keyHex = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey

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
    signTransaction: (
      transaction: SignableTransaction,
    ): SignableTransaction => {
      // Single-signature flow: an existing signature — this key's or a
      // foreign one — means the caller double-signed by mistake; collecting
      // signatures is multiSign's business.
      if (transaction.signature?.length)
        throw new BaseError(
          `The transaction is already signed (${transaction.signature.length} signature(s)) — co-signing a multi-signature transaction goes through multiSign.`,
        )
      return signTransaction({ transaction, privateKey: keyHex, address })
    },
    multiSign: (
      transaction: SignableTransaction,
      options?: AccountMultiSignOptions,
    ): SignableTransaction =>
      multiSignTransaction({
        transaction,
        privateKey: keyHex,
        permissionId: options?.permissionId,
      }),
  }
}
