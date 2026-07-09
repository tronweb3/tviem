// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { BlockRef } from '../utils/transaction/prepareTransaction.js'
import type { Address } from './address.js'

/**
 * A formatted TRON block (mapped from a `getnowblock` / `getblockbynum`
 * response). Satisfies {@link BlockRef}, so it can be fed directly to
 * `fillBlockHeader` to derive a transaction's TaPoS reference fields.
 */
export type Block = {
  /** Block id (`blockID`, 32-byte hash hex). */
  blockID: string
  /** Block number (`block_header.raw_data.number`). */
  number: bigint
  /** Block timestamp in milliseconds. */
  timestamp: bigint
  /** Parent block hash (`parentHash`). */
  parentHash: string
  /** Transaction trie root (`txTrieRoot`). */
  txTrieRoot: string
  /** The producing witness (SR) address, Base58Check-encoded. */
  witnessAddress: Address
  /** Block header version, if present. */
  version?: number | undefined
  /** The block's transactions (raw node shapes; not decoded here). */
  transactions: readonly unknown[]
}

// Compile-time guarantee that a `Block` is a valid `BlockRef`.
type _AssertBlockIsBlockRef = Block extends BlockRef ? true : never
/** @public */
export type BlockIsBlockRef = _AssertBlockIsBlockRef
