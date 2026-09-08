import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { RawData } from './serializeRawData.js'

/** Default transaction lifetime, in milliseconds (one minute). */
export const defaultExpirationMs = 60000n

/**
 * Longest transaction lifetime java-tron accepts, in milliseconds (24 hours,
 * `MAXIMUM_TIME_UNTIL_EXPIRATION`): a node rejects any `expiration` further
 * than this past its head block's time. The head is never older than the
 * reference block this client derives from, so capping the lifetime at
 * reference time + 24h can never trip the node's bound.
 */
export const maxExpirationMs = 86_400_000n

/** A reference block, used to derive TaPoS parameters and transaction timing. */
export type BlockRef = {
  /** Block number (`block_header.raw_data.number`). */
  number: bigint | number
  /** Block id (`blockID`, 32-byte hash hex, bare or `0x`-prefixed). */
  blockID: string
  /**
   * Block timestamp in ms (`block_header.raw_data.timestamp`). This chain time —
   * never the local wall clock — is what a built transaction's `timestamp` and
   * `expiration` are derived from, so a skewed client clock can't produce an
   * already-expired transaction.
   */
  timestamp: bigint | number
}

/** TaPoS reference fields derived from a block (a `raw_data` fragment). */
export type RefBlockParams = {
  /** Last 2 bytes of the block number (bare hex). */
  ref_block_bytes: string
  /** Bytes 8..16 of the block id (bare hex). */
  ref_block_hash: string
}

export type DeriveRefBlockParamsErrorType = BaseErrorType | ErrorType

const blockIdRegex = /^[0-9a-fA-F]{64}$/

/**
 * Derives the TaPoS reference fields from a block. `ref_block_bytes` is the
 * low 2 bytes of the block number (its hex, last 4 chars, left-padded to 4);
 * `ref_block_hash` is bytes 8..16 of the block id (its hex chars 16..32).
 *
 * Both fields enter the transaction's `raw_data` — and so its txID and
 * signature bytes — which is why an invalid source is rejected here instead
 * of being laundered into shape-valid output (a 16-byte id would otherwise
 * still yield a full-width `ref_block_hash`) that the node only rejects at
 * broadcast, after signatures were collected.
 *
 * @param blockNumber Block number: a non-negative `bigint`, or a non-negative
 *   safe-integer `number`.
 * @param blockID Block id: a 32-byte hash hex (bare or `0x`-prefixed).
 * @returns Reference block parameters.
 * @throws {BaseError} If `blockNumber` or `blockID` is invalid.
 */
export function deriveRefBlockParams(
  blockNumber: bigint | number,
  blockID: string,
): RefBlockParams {
  // Primitives only, before anything else: an object would slip past both
  // typed range guards below untouched and reach `toString(16)` / the regex
  // with its own conversions — one rendering vetted, another sliced into the
  // wire. A primitive cannot change between the check and the use.
  if (typeof blockNumber !== 'number' && typeof blockNumber !== 'bigint')
    throw new BaseError(
      `Invalid blockNumber: expected a number or bigint block height, got ${
        blockNumber === null ? 'null' : typeof blockNumber
      }.`,
    )
  if (typeof blockID !== 'string')
    throw new BaseError(
      `Invalid blockID: expected a block hash hex string, got ${
        blockID === null ? 'null' : typeof blockID
      }.`,
    )
  // Only the low 2 bytes are read, so a bigint needs no upper bound — but a
  // `number` past 2^53 - 1 no longer holds every integer, and a fractional or
  // non-finite one would slice its decimal form into nonsense.
  if (
    typeof blockNumber === 'number' &&
    (!Number.isSafeInteger(blockNumber) || blockNumber < 0)
  )
    throw new BaseError(
      `Invalid blockNumber: ${blockNumber}. Expected a non-negative safe-integer block height.`,
    )
  if (typeof blockNumber === 'bigint' && blockNumber < 0n)
    throw new BaseError(
      `Invalid blockNumber: ${blockNumber}. Expected a non-negative block height.`,
    )
  const id = blockID.startsWith('0x') ? blockID.slice(2) : blockID
  if (!blockIdRegex.test(id))
    throw new BaseError(
      `Invalid blockID: ${blockID}. Expected a 32-byte block hash (64 hex characters, with an optional 0x prefix).`,
    )
  const refBlockBytes = blockNumber.toString(16).slice(-4).padStart(4, '0')
  return { ref_block_bytes: refBlockBytes, ref_block_hash: id.slice(16, 32) }
}

export type FillBlockHeaderErrorType =
  | BaseErrorType
  | DeriveRefBlockParamsErrorType
  | ErrorType

/**
 * Fills the TaPoS reference fields plus the `timestamp` and `expiration` of a
 * raw data model from a reference block. Both timing fields come from the
 * block's own `timestamp` (chain time): `timestamp` is the block time and
 * `expiration` is `block.timestamp + 60000` (one minute). The wall clock is
 * never read — this mirrors TronWeb's `getCurrentRefBlockParams`, so a skewed
 * client clock cannot mint an already-expired transaction.
 *
 * A block with a non-positive `number`/`timestamp` or a malformed `blockID`
 * is rejected — see the guard below.
 *
 * `options.expirationMs` overrides the default one-minute lifetime; it is a
 * duration added to the block's timestamp (still chain time, never the wall
 * clock) and must be a positive integer no greater than
 * {@link maxExpirationMs} — java-tron rejects anything longer.
 *
 * @param rawData Raw data model to fill.
 * @param block Reference block (supplies TaPoS fields and the base timestamp).
 * @param options `expirationMs` — lifetime in ms. @default 60_000
 * @returns A new raw data model with TaPoS, timestamp and expiration set.
 */
export function fillBlockHeader(
  rawData: RawData,
  block: BlockRef,
  options: { expirationMs?: bigint | number | undefined } = {},
): RawData {
  let lifetimeMs = defaultExpirationMs
  if (options.expirationMs !== undefined) {
    // Integer-check numbers first: BigInt(1.5) would escape as a raw
    // RangeError instead of the typed error below.
    if (
      typeof options.expirationMs === 'number' &&
      !Number.isInteger(options.expirationMs)
    )
      throw new BaseError(
        `Invalid expirationMs: ${options.expirationMs}. Expected an integer number of milliseconds.`,
      )
    lifetimeMs = BigInt(options.expirationMs)
    if (lifetimeMs <= 0n || lifetimeMs > maxExpirationMs)
      throw new BaseError(
        `Invalid expirationMs: ${lifetimeMs}. Expected a lifetime in (0, ${maxExpirationMs}] ms — java-tron caps expiration at 24 hours past the reference block.`,
      )
  }
  // A usable TaPoS reference needs all three fields to be real. `formatBlock`
  // decodes a proto3-omitted number/timestamp as 0 (legitimate only for the
  // genesis block, which a new transaction never references) and a missing
  // blockID as '' — deriving from those would build, and let the caller sign,
  // a transaction with ref_block_bytes "0000" and a 1970 expiration that the
  // node only rejects at broadcast. Fail here, before anything is signed.
  const timestamp = BigInt(block.timestamp)
  const id = block.blockID.startsWith('0x')
    ? block.blockID.slice(2)
    : block.blockID
  if (BigInt(block.number) <= 0n || timestamp <= 0n || !blockIdRegex.test(id))
    throw new BaseError(
      'Cannot derive TaPoS reference fields from an incomplete block: a positive number, a positive timestamp and a 32-byte blockID are required.',
    )
  return {
    ...rawData,
    ...deriveRefBlockParams(block.number, block.blockID),
    timestamp,
    expiration: timestamp + lifetimeMs,
  }
}
