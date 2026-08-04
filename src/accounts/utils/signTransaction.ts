import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { AddressInput } from '../../types/address.js'
import type { Hex } from '../../types/misc.js'
import {
  type IsAddressEqualErrorType,
  isAddressEqual,
} from '../../utils/address/isAddressEqual.js'
import { type ToHexErrorType, toHex } from '../../utils/address/toHex.js'
import { bareHex } from '../../utils/index.js'
import { type SignErrorType, sign } from '../../utils/signature/sign.js'
import {
  type GetTransactionIdErrorType,
  getTransactionId,
} from '../../utils/transaction/getTransactionId.js'
import {
  type TxCheckErrorType,
  txCheck,
} from '../../utils/transaction/txCheck.js'
import type { SignableTransaction } from '../types.js'
import {
  type PrivateKeyToAddressErrorType,
  privateKeyToAddress,
} from './privateKeyToAddress.js'

export type SignTransactionParameters = {
  /**
   * The transaction to sign — the full `txID` + `raw_data` + `raw_data_hex`
   * triple, verified for mutual consistency before signing.
   */
  transaction: SignableTransaction
  /** The secp256k1 private key, as `0x`-prefixed or bare hex. */
  privateKey: Hex | string
  /**
   * The address the `owner_address` guard compares against — the signing
   * account by default (derived from `privateKey`). Supplying a different
   * address relaxes the guard (trusted input): `multiSign` passes the
   * transaction's own `owner_address` here, behind its permission
   * validations, so a non-owner co-signer can sign.
   */
  address?: AddressInput | undefined
}

export type SignTransactionErrorType =
  | PrivateKeyToAddressErrorType
  | GetTransactionIdErrorType
  | TxCheckErrorType
  | IsAddressEqualErrorType
  | ToHexErrorType
  | SignErrorType
  | BaseErrorType
  | ErrorType

/**
 * Signs a transaction locally with a secp256k1 private key and appends the
 * signature to its `signature` list — the input is never mutated. Signing is
 * synchronous and deterministic (RFC 6979, low-`s`, no extra entropy).
 *
 * `raw_data` is java-tron's HTTP JSON (`visible: false`) shape — the one and
 * only dialect, whether built by this SDK, returned by
 * `wallet/createtransaction`, or handed over by TronWeb. The bytes are the
 * source of truth: the JSON must serialize to exactly the `raw_data_hex`
 * bytes, and the signed digest is their SHA-256 (`txID`).
 *
 * Guards, in order:
 * 1. The transaction must pass {@link txCheck}: `txID`, `raw_data` and
 *    `raw_data_hex` are all present and mutually consistent — `raw_data`
 *    serializes to exactly the `raw_data_hex` bytes, whose SHA-256
 *    ({@link getTransactionId}) is `txID` — otherwise it throws. This
 *    refuses blind signing (a digest without its content) and any `txID` or
 *    JSON that lies about the bytes; a node-supplied `txID` is never
 *    trusted unverified. Partial forms do not sign — build the full triple
 *    first (`buildTransaction` does).
 * 2. The first contract's `owner_address` must equal `address` — the
 *    signing account, unless the caller supplied one — otherwise it throws.
 *    A contract whose owner cannot be read (an `__unknown` parameter) is
 *    refused. Non-owner co-signing goes through the `multiSign` action,
 *    which satisfies this guard via the `address` parameter after its own
 *    permission validations.
 * 3. If this key's signature is already present it is not appended twice
 *    (compared hex-case-insensitively — the wire value is bytes).
 *
 * @param parameters Transaction, private key, optional expected address.
 * @returns A new {@link SignableTransaction} — the verified
 * `txID`/`raw_data`/`raw_data_hex` unchanged, with this signature appended.
 */
export function signTransaction(
  parameters: SignTransactionParameters,
): SignableTransaction {
  const { transaction, privateKey } = parameters
  const address = parameters.address ?? privateKeyToAddress(privateKey)

  if (!txCheck(transaction))
    throw new BaseError('The transaction failed its integrity check (txCheck).')

  const { raw_data, txID } = transaction
  const owner = (raw_data.contract[0]?.parameter.value as any).owner_address
  if (owner === undefined || !isAddressEqual(toHex(owner), address))
    throw new BaseError(
      `The transaction's owner_address does not match the signing account (${address}).`,
    )

  const sig = sign({ hash: `0x${bareHex(txID)}`, privateKey }).hex
  const existing = transaction.signature ?? []
  const signature = existing.some((s) => s.toLowerCase() === sig)
    ? [...existing]
    : [...existing, sig]

  return {
    ...transaction,
    signature,
  }
}
