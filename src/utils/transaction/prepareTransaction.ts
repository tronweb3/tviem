import type { ErrorType } from '../../errors/utils.js'
import type { RawData } from './serializeRawData.js'

/** Default transaction lifetime, in milliseconds (one minute). */
export const defaultExpirationMs = 60000n

/** A reference block, used to derive TaPoS parameters. */
export type BlockRef = {
  /** Block number (`block_header.raw_data.number`). */
  number: bigint | number
  /** Block id (`blockID`, 32-byte hash hex, bare or `0x`-prefixed). */
  blockID: string
}

/** TaPoS reference fields derived from a block. */
export type RefBlockParams = {
  /** `ref_block_bytes`: last 2 bytes of the block number (bare hex). */
  refBlockBytes: string
  /** `ref_block_hash`: bytes 8..16 of the block id (bare hex). */
  refBlockHash: string
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
  return { refBlockBytes, refBlockHash: id.slice(16, 32) }
}

export type FillBlockHeaderErrorType = DeriveRefBlockParamsErrorType | ErrorType

/**
 * Fills the TaPoS reference fields and the expiration of a raw data model
 * from a reference block. `expiration` is set to `now + 60000` (one minute).
 * `now` must be supplied by the caller — the wall clock is never read.
 *
 * @param rawData Raw data model to fill.
 * @param block Reference block.
 * @param now Current time, in milliseconds.
 * @returns A new raw data model with TaPoS and expiration set.
 */
export function fillBlockHeader(
  rawData: RawData,
  block: BlockRef,
  now: bigint | number,
): RawData {
  const { refBlockBytes, refBlockHash } = deriveRefBlockParams(
    block.number,
    block.blockID,
  )
  return {
    ...rawData,
    refBlockBytes,
    refBlockHash,
    expiration: BigInt(now) + defaultExpirationMs,
  }
}
