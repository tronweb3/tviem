import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { RawData } from './serializeRawData.js'

/** Default transaction lifetime, in milliseconds (one minute). */
export const defaultExpirationMs = 60000n

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

export type DeriveRefBlockParamsErrorType = ErrorType

/**
 * Derives the TaPoS reference fields from a block. `ref_block_bytes` is the
 * low 2 bytes of the block number (its hex, last 4 chars, left-padded to 4);
 * `ref_block_hash` is bytes 8..16 of the block id (its hex chars 16..32).
 *
 * @param blockNumber Block number.
 * @param blockID Block id hash hex (bare or `0x`-prefixed).
 * @returns Reference block parameters.
 */
export function deriveRefBlockParams(
  blockNumber: bigint | number,
  blockID: string,
): RefBlockParams {
  const refBlockBytes = blockNumber.toString(16).slice(-4).padStart(4, '0')
  const id = blockID.startsWith('0x') ? blockID.slice(2) : blockID
  return { ref_block_bytes: refBlockBytes, ref_block_hash: id.slice(16, 32) }
}

export type FillBlockHeaderErrorType =
  | BaseErrorType
  | DeriveRefBlockParamsErrorType
  | ErrorType

const blockIdRegex = /^[0-9a-fA-F]{64}$/

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
 * @param rawData Raw data model to fill.
 * @param block Reference block (supplies TaPoS fields and the base timestamp).
 * @returns A new raw data model with TaPoS, timestamp and expiration set.
 */
export function fillBlockHeader(rawData: RawData, block: BlockRef): RawData {
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
    expiration: timestamp + defaultExpirationMs,
  }
}
