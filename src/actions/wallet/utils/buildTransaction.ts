import type { SignableTransaction } from '../../../accounts/types.js'
import type { Client } from '../../../clients/createClient.js'
import { BaseError, type BaseErrorType } from '../../../errors/base.js'
import type { ErrorType } from '../../../errors/utils.js'
import type { ByteArray, Hex } from '../../../types/misc.js'
import {
  type BareHexErrorType,
  bareHex,
} from '../../../utils/encoding/bareHex.js'
import { getAction } from '../../../utils/getAction.js'
import { type Sha256ErrorType, sha256 } from '../../../utils/hash/sha256.js'
import {
  type DecodeRawDataErrorType,
  decodeRawData,
} from '../../../utils/transaction/decodeRawData.js'
import {
  type DeriveRefBlockParamsErrorType,
  fillBlockHeader,
} from '../../../utils/transaction/prepareTransaction.js'
import {
  type RawContract,
  type RawData,
  type SerializeRawDataErrorType,
  serializeRawData,
} from '../../../utils/transaction/serializeRawData.js'
import {
  type GetNowBlockErrorType,
  getNowBlock,
} from '../../public/getNowBlock.js'

/**
 * A fully-specified TaPoS + timing header — a `raw_data` fragment, so its
 * keys are the raw_data keys (TronWeb's `blockHeader` option is the same
 * shape). When supplied to {@link buildTransaction} it is used in place of
 * the latest block: the values are format-checked and written verbatim.
 * Lets a caller build (and diff) transactions fully offline against a
 * pinned block.
 */
export type TransactionHeader = {
  /** Low 2 bytes of the block number (bare hex). */
  ref_block_bytes: string
  /** Bytes 8..16 of the block id (bare hex). */
  ref_block_hash: string
  /** Expiration timestamp in ms (`raw_data.expiration`). */
  expiration: bigint | number
  /** Creation timestamp in ms (`raw_data.timestamp`). */
  timestamp: bigint | number
}

/**
 * Memo input: `0x`-prefixed hex or raw bytes. Written to `raw_data.data`
 * verbatim — a UTF-8 text memo is the caller's bytes to produce (e.g.
 * `stringToBytes`/`toHex`), never guessed from a plain string.
 */
export type MemoInput = Hex | ByteArray

export type BuildTransactionParameters = {
  /** The single `Transaction.Contract` to wrap in the transaction. */
  contract: RawContract
  /** Energy/bandwidth fee ceiling in SUN (`raw_data.fee_limit`). */
  feeLimit?: bigint | undefined
  /**
   * Optional memo, written to `raw_data.data` (hex or raw bytes). Enters the
   * signed bytes. The chain charges a memo fee on top of the transaction's
   * normal costs (`getMemoFee` chain parameter — 1 TRX on mainnet and Nile).
   * An empty memo is rejected: zero bytes serialize to no field at all, which
   * would silently build a memo-less transaction.
   */
  memo?: MemoInput | undefined
  /**
   * Multi-sig permission id (`Contract.Permission_id`). When set it is written
   * into the contract before the `txID` is derived, so the built transaction is
   * bound to that active/owner permission (mirrors `multiSignTransaction`).
   */
  permissionId?: number | undefined
  /**
   * A pre-derived TaPoS + timing {@link TransactionHeader}. When supplied the
   * node is NOT queried and these fields are used verbatim (offline build);
   * otherwise the latest block is fetched and the header is derived from the
   * block's own timestamp. Mirrors TronWeb's `blockHeader` override.
   */
  blockHeader?: TransactionHeader | undefined
  /**
   * Transaction lifetime in ms, applied to the chain-derived timestamp
   * (`expiration = refBlock.timestamp + expirationMs`). Must be a positive
   * integer of at most 86_400_000 (24h, the longest java-tron accepts).
   * Ignored when a complete `blockHeader` is supplied — the header's absolute
   * `expiration` is used verbatim. @default 60_000
   */
  expirationMs?: bigint | number | undefined
}

/**
 * A fully built but **unsigned** transaction: `txID` + `raw_data` +
 * `raw_data_hex`, with no `signature` yet. Ready to hand to an account's
 * `signTransaction`, to `multiSign`, or to `getSignWeight`.
 */
export type BuildTransactionReturnType = SignableTransaction & {
  visible: false
}

export type BuildTransactionErrorType =
  | BareHexErrorType
  | BaseErrorType
  | DecodeRawDataErrorType
  | DeriveRefBlockParamsErrorType
  | GetNowBlockErrorType
  | SerializeRawDataErrorType
  | Sha256ErrorType
  | ErrorType

/**
 * The shared TRON build phase extracted from {@link buildAndBroadcast}: wrap a
 * single already-built `RawContract` into a `raw_data` model, attach `fee_limit`
 * / the `memo` bytes (`raw_data.data`) when supplied, fill its TaPoS reference
 * fields + `timestamp` +
 * `expiration`, then locally compute the `txID` and `raw_data_hex`. Nothing is
 * signed or broadcast.
 *
 * Timing is chain-derived, never wall-clock: when `blockHeader` is supplied it
 * is used verbatim (fully offline build); otherwise the latest block is fetched
 * and the `timestamp` / `expiration` come from the block's own timestamp. This
 * mirrors TronWeb's `createTransaction` and keeps a skewed client clock from
 * minting an already-expired transaction.
 *
 * @param client The Client to use.
 * @param parameters The built contract, optional fee/memo/permission/header.
 * @returns An unsigned {@link SignableTransaction} (`txID` recomputed locally).
 */
export async function buildTransaction(
  client: Client,
  parameters: BuildTransactionParameters,
): Promise<BuildTransactionReturnType> {
  const { contract, feeLimit, memo, permissionId, blockHeader, expirationMs } =
    parameters

  // Normalize and validate the memo once, here (single choke point for every
  // action) and BEFORE any node call. Zero bytes are refused: proto3 drops an
  // empty `data` from the wire, so an "empty memo" would silently build a
  // transaction carrying no memo at all. Non-hex or odd-nibble strings are
  // refused too — the serializer would otherwise left-pad a stray nibble and
  // quietly rewrite the memo's bytes.
  let data: string | undefined
  if (memo !== undefined) {
    if (typeof memo !== 'string' && !(memo instanceof Uint8Array))
      throw new BaseError(
        'Invalid memo: expected `0x`-prefixed hex or raw bytes (Uint8Array).',
      )
    data = bareHex(memo)
    if (data === '')
      throw new BaseError(
        'Empty memo: `memo` must carry at least one byte (omit it for no memo).',
      )
    if (!/^(?:[0-9a-f]{2})+$/.test(data))
      throw new BaseError(
        'Invalid memo: not whole-byte hex (odd length or non-hex characters). Encode text memos to hex first (e.g. via `toHex`).',
      )
  }

  // Reject a malformed permission id here, before any node call — the same
  // guard `multiSignTransaction` applies. This is the canonical place to bind
  // an id, so it must not be the looser of the two: a negative id encodes as a
  // 10-byte two's-complement varint and decodes back past Number's precision,
  // yielding a transaction that fails the SDK's own `txCheck`, and a
  // non-integer escapes `BigInt()` as a raw RangeError from the writer.
  // Nothing bounds the id from above: java-tron has no numeric maximum, only
  // the requirement that the id resolve to a permission on the signing
  // account, which cannot be checked offline.
  if (
    permissionId !== undefined &&
    (!Number.isInteger(permissionId) || permissionId < 0)
  )
    throw new BaseError(
      `Invalid multi-sig permission id: ${permissionId}. Expected a non-negative integer (an active permission's id is >= 2).`,
    )

  // Bake the permission id into the contract before the id is derived, so the
  // built transaction is bound to that permission (matches multiSignTransaction).
  const boundContract =
    permissionId !== undefined
      ? { ...contract, Permission_id: permissionId }
      : contract

  // Wrap the contract in the raw_data model (fee_limit / data only when given).
  let rawData: RawData = { contract: [boundContract] }
  if (feeLimit !== undefined) rawData = { ...rawData, fee_limit: feeLimit }
  if (data !== undefined) rawData = { ...rawData, data }

  // Timing + TaPoS: a custom header is used verbatim (no node call);
  // otherwise derive them from the latest block's own timestamp.
  if (blockHeader) {
    // Hold the override to the same postcondition the derived path meets:
    // sized TaPoS fields and positive timing, before anything can be signed.
    const { ref_block_bytes, ref_block_hash, expiration, timestamp } =
      blockHeader
    if (!/^[0-9a-fA-F]{4}$/.test(ref_block_bytes))
      throw new BaseError(
        `Invalid blockHeader.ref_block_bytes: expected 2 bytes of bare hex, got "${ref_block_bytes}".`,
      )
    if (!/^[0-9a-fA-F]{16}$/.test(ref_block_hash))
      throw new BaseError(
        `Invalid blockHeader.ref_block_hash: expected 8 bytes of bare hex, got "${ref_block_hash}".`,
      )
    for (const [name, value] of [
      ['timestamp', timestamp],
      ['expiration', expiration],
    ] as const) {
      if (typeof value === 'number' && !Number.isInteger(value))
        throw new BaseError(
          `Invalid blockHeader.${name}: ${value}. Expected an integer timestamp in ms.`,
        )
      if (BigInt(value) <= 0n)
        throw new BaseError(
          `Invalid blockHeader.${name}: ${value}. Expected a positive timestamp in ms.`,
        )
    }
    rawData = { ...rawData, ...blockHeader }
  } else {
    // Explicitly the chain head, never solidified state: `expiration` is
    // derived from the reference block's own timestamp, so a solidified block
    // — which trails the head — would leave a default-lifetime transaction
    // almost no time to be packed. Transaction validity must not depend on
    // another action's default.
    const block = await getAction(
      client,
      getNowBlock,
      'getNowBlock',
    )({ confirmed: false })
    rawData = fillBlockHeader(rawData, block, { expirationMs })
  }

  // Canonicalize once through the encode∘decode roundtrip so the built
  // transaction is the canonical node-JSON shape end to end (flexible
  // encode-side inputs — bigint, 0x-hex, Base58 addresses — never leak out),
  // then derive the id locally from those bytes (never trusted from a node).
  const bytes = serializeRawData(rawData)
  const canonical = decodeRawData(bytes)
  return {
    visible: false,
    txID: sha256(bytes, 'hex').slice(2),
    raw_data: canonical,
    raw_data_hex: bareHex(bytes),
  }
}
