// TRON-specific, clean-room implementation for @tronweb3/omni.
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Address } from '../../types/address.js'
import type { Hex } from '../../types/misc.js'
import {
  type IsAddressEqualErrorType,
  isAddressEqual,
} from '../../utils/address/isAddressEqual.js'
import { type ToHexErrorType, toHex } from '../../utils/address/toHex.js'
import { type SignErrorType, sign } from '../../utils/signature/sign.js'
import {
  type GetTransactionIdErrorType,
  getTransactionId,
} from '../../utils/transaction/getTransactionId.js'
import {
  type ResolveRawDataErrorType,
  resolveRawData,
} from '../../utils/transaction/nodeRawData.js'
import {
  type RawData,
  type ToRawDataHexErrorType,
  toRawDataHex,
} from '../../utils/transaction/serializeRawData.js'
import { toNodeRawData } from '../../utils/transaction/toNodeRawData.js'
import {
  type TxCheckErrorType,
  txCheck,
} from '../../utils/transaction/txCheck.js'
import type {
  ContractAddressInput,
  UnknownContractParameter,
} from '../../utils/transaction/types.js'
import type { SignableTransaction } from '../types.js'
import {
  type PrivateKeyToAddressErrorType,
  privateKeyToAddress,
} from './privateKeyToAddress.js'

export type SignTransactionParameters = {
  /** The transaction to sign, carrying a `txID` and/or a `raw_data` model. */
  transaction: SignableTransaction
  /** The secp256k1 private key, as `0x`-prefixed or bare hex. */
  privateKey: Hex | string
  /**
   * The signer's canonical address, used by the `owner_address` guard.
   * Derived from `privateKey` when omitted.
   */
  address?: Address | undefined
  /**
   * Multi-sig permission id. When provided it is written into every contract
   * before the id is derived, and the `owner_address` guard is skipped.
   */
  permissionId?: number | undefined
}

export type SignTransactionErrorType =
  | PrivateKeyToAddressErrorType
  | ResolveRawDataErrorType
  | GetTransactionIdErrorType
  | ToRawDataHexErrorType
  | TxCheckErrorType
  | IsAddressEqualErrorType
  | ToHexErrorType
  | SignErrorType
  | BaseErrorType
  | ErrorType

/** Extracts the `ownerAddress` from a raw data's first contract, if known. */
function ownerAddressOf(rawData: RawData): ContractAddressInput | undefined {
  const first = rawData.contract[0]
  if (!first) return undefined
  const value = first.parameter.value
  if ((value as UnknownContractParameter).__unknown === true) return undefined
  return (value as { ownerAddress?: ContractAddressInput }).ownerAddress
}

/**
 * Signs a transaction locally with a secp256k1 private key and appends the
 * signature to its `signature` list — the input is never mutated. Signing is
 * synchronous and deterministic (RFC 6979, low-`s`, no extra entropy).
 *
 * `raw_data` is accepted in EITHER dialect: the SDK model, or java-tron's
 * node JSON exactly as `wallet/createtransaction` / TronWeb hand it over
 * (which must then carry `raw_data_hex` — the bytes are the source of truth
 * and the JSON is verified to describe them). The signed result's `raw_data`
 * is always the node JSON, so it can be passed to any TRON tool or JSON
 * endpoint as-is.
 *
 * Guards, in order:
 * 1. When `permissionId` is given it is written into every contract of
 *    `raw_data` before the id is derived (multi-sig / permission signing).
 *    The write is unconditional — an id already baked into the transaction
 *    is overwritten, which changes the txID and silently orphans any
 *    collected signatures. This is the low-level escape hatch; co-signing
 *    should go through the `multiSign` action, which validates the id
 *    against the baked one (and the collected signatures) first.
 * 2. The transaction id is always recomputed locally from `raw_data` via
 *    {@link getTransactionId}; a node-supplied `txID` is never trusted when a
 *    `raw_data` (or `raw_data_hex`) is present.
 * 3. The first contract's `owner_address` must equal the signing account's
 *    address, otherwise it throws. This guard is skipped when `permissionId`
 *    is set (the signer need not be the owner in a multi-sig flow).
 * 4. The serialized transaction must pass {@link txCheck} (decode ∘
 *    re-serialize is self-consistent and matches the id).
 * 5. If this key's signature is already present it is not appended twice
 *    (compared hex-case-insensitively — the wire value is bytes).
 *
 * When only a `txID` (and no `raw_data`/`raw_data_hex`) is supplied, guards
 * 3 and 4 are not applicable and the supplied id is signed as-is.
 *
 * @param parameters Transaction, private key, optional address and permission.
 * @returns A new {@link SignableTransaction} with the recomputed `txID`, the
 * canonical `raw_data`/`raw_data_hex`, and the appended `signature`.
 */
export function signTransaction(
  parameters: SignTransactionParameters,
): SignableTransaction {
  const { transaction, privateKey, permissionId } = parameters
  const address = parameters.address ?? privateKeyToAddress(privateKey)

  // Resolve raw_data from either dialect: the SDK model is used as-is; a
  // node-JSON raw_data (a chain-/TronWeb-built transaction passed verbatim)
  // is resolved from its raw_data_hex BYTES and the JSON is verified to
  // describe those exact bytes; a bare raw_data_hex is decoded.
  let rawData = resolveRawData(transaction)

  // Guard 1: write the permission id into the transaction before the id.
  if (rawData && permissionId !== undefined)
    rawData = {
      ...rawData,
      contract: rawData.contract.map((contract) => ({
        ...contract,
        permissionId,
      })),
    }

  // Guard 2: always recompute the id locally; never trust a node-supplied one.
  const txID = rawData ? getTransactionId(rawData) : transaction.txID
  if (!txID)
    throw new BaseError(
      'Cannot sign transaction: neither `txID` nor `raw_data` was provided.',
    )

  let rawDataHex: string | undefined
  if (rawData) {
    // Guard 3: owner_address must match the signer (skipped for multi-sig).
    if (permissionId === undefined) {
      const owner = ownerAddressOf(rawData)
      if (owner !== undefined && !isAddressEqual(toHex(owner), address))
        throw new BaseError(
          `The transaction's owner_address does not match the signing account (${address}).`,
        )
    }
    // Guard 4: the serialized transaction must be self-consistent.
    rawDataHex = toRawDataHex(rawData)
    if (!txCheck(rawDataHex, txID))
      throw new BaseError(
        'The transaction failed its integrity check (txCheck).',
      )
  }

  // Guard 5: sign and append, de-duplicating this key's signature. The wire
  // value is bytes, so the compare ignores hex case — TronWeb renders the
  // trailing recovery byte uppercase ('…1B'/'…1C') where ours is lowercase,
  // and a duplicate-key signature makes the node reject the broadcast.
  const sig = sign({ hash: `0x${txID}`, privateKey }).hex
  const existing = transaction.signature ?? []
  const signature = existing.some((s) => s.toLowerCase() === sig)
    ? [...existing]
    : [...existing, sig]

  const result: SignableTransaction = { ...transaction, txID, signature }
  if (rawData) {
    // The result speaks the node dialect — the returned JSON is what the
    // chain/TronWeb/explorers exchange, so a signed transaction can be
    // handed to any tool (or the node's own JSON endpoints) as-is. A
    // contract type with no registered codec cannot be rendered; it keeps
    // the SDK model (broadcasting still works — it uses raw_data_hex).
    try {
      result.raw_data = toNodeRawData(rawData)
    } catch {
      result.raw_data = rawData
    }
    result.raw_data_hex = rawDataHex
  }
  return result
}
