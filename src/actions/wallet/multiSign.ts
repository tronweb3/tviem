// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { SignableTransaction } from '../../accounts/types.js'
import {
  type PrivateKeyToAddressErrorType,
  privateKeyToAddress,
} from '../../accounts/utils/privateKeyToAddress.js'
import {
  type SignTransactionErrorType,
  signTransaction,
} from '../../accounts/utils/signTransaction.js'
import type { Client } from '../../clients/createClient.js'
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Hex } from '../../types/misc.js'
import { isAddressEqual } from '../../utils/address/isAddressEqual.js'
import { getAction } from '../../utils/getAction.js'
import { decodeRawData } from '../../utils/transaction/decodeRawData.js'
import { getSignWeight } from '../public/getSignWeight.js'
import type { AssertUnchangedTransactionErrorType } from '../utils/assertUnchangedTransaction.js'

export type MultiSignParameters = {
  /** The transaction to co-sign — fresh or already carrying other signatures. */
  transaction: SignableTransaction
  /** A signer's secp256k1 private key, `0x`-prefixed or bare hex. */
  privateKey: Hex | string
  /** The active/owner permission id (`Permission.id`) this signature is for. */
  permissionId: number
}

export type MultiSignReturnType = SignableTransaction

export type MultiSignErrorType =
  | SignTransactionErrorType
  | PrivateKeyToAddressErrorType
  // The bundled `getSignWeight` pre-check fails closed on a tampered echo.
  | AssertUnchangedTransactionErrorType
  | BaseErrorType
  | ErrorType

/**
 * Adds one party's signature to a multi-signature transaction under a permission
 * id and returns the co-signed transaction — a single call that mirrors
 * TronWeb's `multiSign` ergonomics (the node round-trip and the pre-checks are
 * bundled in, so a caller never has to pair it with a separate `getSignWeight`),
 * **without** TronWeb's flaw of signing the transaction the node hands back.
 *
 * What it signs is always the **local** transaction: {@link signTransaction}
 * writes `permissionId` into every contract, recomputes the txID locally from
 * `raw_data` (a node-supplied id is never trusted), skips the owner-address
 * guard so a non-owner co-signer can sign, and de-duplicates this key's
 * signature. The bytes it signs are the exact bytes it serialized itself, so the
 * node can never substitute what gets signed.
 *
 * When this is the first signature establishing a (positive) permission id, it
 * pre-validates against the on-chain permission via {@link getSignWeight}
 * (querying with the signatures present *before* this one, so `approvedList`
 * reflects who signed earlier):
 * - throws if the node reports `PERMISSION_ERROR`;
 * - throws if the signer's address is absent from the permission's keys;
 * - throws if the signer has already signed.
 *
 * `getSignWeight` additionally fails closed (`TransactionTamperedError`) if the
 * node echoes bytes that differ from the local transaction. A transaction that
 * already carries the permission id (a later co-signer, or an offline flow) is
 * signed locally with **no** node contact, so co-signing can proceed offline.
 *
 * Because the permission id must be injected before the id is derived, this
 * takes a raw `privateKey`: a `TronAccount`'s bound signer intentionally does
 * not forward a `permissionId`.
 *
 * @param client The Client to use.
 * @param parameters Transaction, a signer's private key, the permission id.
 * @returns A new {@link SignableTransaction} with this signature appended.
 */
export async function multiSign(
  client: Client,
  parameters: MultiSignParameters,
): Promise<MultiSignReturnType> {
  const { transaction, privateKey, permissionId } = parameters

  if (!Number.isInteger(permissionId) || permissionId < 0)
    throw new BaseError(
      `Invalid multi-sig permission id: ${permissionId}. Expected a non-negative integer (an active permission's id is >= 2).`,
    )

  // Sign locally first: the returned bytes are the single source of truth for
  // both the weight query and the value handed back. A node substitution can
  // never reach this signature.
  const signed = signTransaction({ transaction, privateKey, permissionId })

  // Mirror TronWeb's gate: only round-trip the node to pre-validate membership
  // when this signature is establishing a fresh, positive permission id. A
  // transaction already carrying the permission id (a later co-signer / offline
  // flow) is signed locally with no node contact.
  const rawData =
    transaction.raw_data ??
    (transaction.raw_data_hex
      ? decodeRawData(transaction.raw_data_hex)
      : undefined)
  const alreadyEstablished = Boolean(rawData?.contract?.[0]?.permissionId)
  if (permissionId <= 0 || alreadyEstablished) return signed

  // Pre-validate against the on-chain permission. Query with the signatures that
  // were present *before* this one so `approvedList` reflects prior signers; the
  // action also asserts the node's echoed bytes match the local transaction.
  const probe: SignableTransaction = {
    ...signed,
    signature: transaction.signature ? [...transaction.signature] : [],
  }
  const weight = await getAction(
    client,
    getSignWeight,
    'getSignWeight',
  )({ transaction: probe })

  if (weight.result?.code === 'PERMISSION_ERROR')
    throw new BaseError(
      weight.result.message ??
        'The active permission rejected the transaction.',
    )

  const signer = privateKeyToAddress(privateKey)
  const keys = weight.permission?.keys
  if (!keys)
    throw new BaseError(
      'getSignWeight returned no permission to validate the signer against.',
    )
  if (!keys.some((key) => isAddressEqual(key.address, signer)))
    throw new BaseError(
      `Address ${signer} has no permission to sign this transaction.`,
    )
  if (weight.approvedList.some((address) => isAddressEqual(address, signer)))
    throw new BaseError(
      `Address ${signer} has already signed this transaction.`,
    )

  return signed
}
