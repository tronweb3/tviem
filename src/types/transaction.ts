import type { Address } from './address.js'
import type { Hex } from './misc.js'

/** Coarse execution status derived from a transaction receipt. */
export type TransactionStatus = 'success' | 'reverted'

/** A decoded event log entry from a transaction receipt. */
export type TransactionLog = {
  /** Emitting contract address, Base58Check-encoded. */
  address: Address
  /** Indexed topics, each `0x`-prefixed. */
  topics: readonly Hex[]
  /** Non-indexed data, `0x`-prefixed. */
  data: Hex
}

/**
 * A formatted transaction receipt / execution info (mapped from a
 * `gettransactioninfobyid` response). All resource / fee amounts are in SUN.
 */
export type TransactionInfo = {
  /** Transaction id (64 hex chars, no `0x`). */
  id: string
  /** Number of the block the transaction was included in. */
  blockNumber: bigint
  /** Timestamp (ms) of the including block. */
  blockTimeStamp: bigint
  /** Coarse execution status (`'success'` | `'reverted'`). */
  status: TransactionStatus
  /** Total fee burned (SUN). */
  fee: bigint
  /** Energy consumed by the caller. */
  energyUsage: bigint
  /** Total energy consumed (caller + contract origin). */
  energyUsageTotal: bigint
  /** Energy fee burned (SUN). */
  energyFee: bigint
  /** Bandwidth (net) consumed. */
  netUsage: bigint
  /** Bandwidth (net) fee burned (SUN). */
  netFee: bigint
  /** Raw ABI-encoded return values (bare hex, no `0x`). */
  contractResult: readonly string[]
  /** Contract address for a contract call, Base58Check-encoded. */
  contractAddress?: Address | undefined
  /** Emitted event logs. */
  logs: readonly TransactionLog[]
}
