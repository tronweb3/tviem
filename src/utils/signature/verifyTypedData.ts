// TRON-specific, clean-room implementation for @tronweb3/tviem.
import type { ErrorType } from '../../errors/utils.js'
import type { Address, AddressInput } from '../../types/address.js'
import {
  type IsAddressEqualErrorType,
  isAddressEqual,
} from '../address/isAddressEqual.js'
import {
  type PublicKeyToAddressErrorType,
  publicKeyToAddress,
} from '../address/publicKeyToAddress.js'
import {
  type HashTypedDataErrorType,
  type HashTypedDataParameters,
  hashTypedData,
} from './hashTypedData.js'
import {
  type RecoverPublicKeyErrorType,
  recoverPublicKey,
  type SignatureInput,
} from './verifyMessage.js'

export type RecoverTypedDataAddressParameters = HashTypedDataParameters & {
  /** The signature over the TIP-712 digest of the typed data. */
  signature: SignatureInput
}

export type RecoverTypedDataAddressErrorType =
  | HashTypedDataErrorType
  | RecoverPublicKeyErrorType
  | PublicKeyToAddressErrorType
  | ErrorType

/**
 * Recovers the TRON Base58Check address that produced a TIP-712 typed-data
 * signature.
 *
 * @param parameters The typed data (`domain`, `types`, `primaryType`,
 * `message`) and its `signature`.
 * @returns The signer's Base58Check address (`T…`).
 */
export function recoverTypedDataAddress({
  signature,
  ...typedData
}: RecoverTypedDataAddressParameters): Address {
  return publicKeyToAddress(
    recoverPublicKey({ hash: hashTypedData(typedData), signature }),
  )
}

export type VerifyTypedDataParameters = HashTypedDataParameters & {
  /** The signature over the TIP-712 digest of the typed data. */
  signature: SignatureInput
  /** The address expected to have signed the typed data (any TRON form). */
  address: AddressInput
}

export type VerifyTypedDataErrorType =
  | RecoverTypedDataAddressErrorType
  | IsAddressEqualErrorType
  | ErrorType

/**
 * Verifies that `address` produced the TIP-712 signature over the typed data.
 *
 * Recovers the signer with {@link recoverTypedDataAddress} and compares it to
 * `address` across all TRON address forms. Returns `false` (never throws) if
 * the signature is malformed or does not match.
 *
 * @returns `true` if the signature is valid for `address`, otherwise `false`.
 */
export function verifyTypedData({
  address,
  signature,
  ...typedData
}: VerifyTypedDataParameters): boolean {
  try {
    return isAddressEqual(
      recoverTypedDataAddress({ ...typedData, signature }),
      address,
    )
  } catch {
    return false
  }
}
