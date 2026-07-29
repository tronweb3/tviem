import type { Address, AddressInput } from '../../types/address.js'
import type { Hex } from '../../types/misc.js'
import { toBase58 } from '../../utils/address/toBase58.js'

/**
 * A raw event entry as returned by a TronGrid `/v1/*` event endpoint. TronGrid
 * pre-decodes the parameters into `result` (keyed by both position and name)
 * with `result_type` giving each parameter's Solidity type; addresses arrive as
 * 20-byte EVM hex (`0x…`, no `41` prefix) and integers as decimal strings.
 */
export type RawTronEvent = {
  block_number?: number | undefined
  block_timestamp?: number | undefined
  caller_contract_address?: string | undefined
  contract_address?: string | undefined
  event_index?: number | undefined
  event_name?: string | undefined
  result?: Record<string, unknown> | undefined
  result_type?: Record<string, string> | undefined
  event?: string | undefined
  transaction_id?: string | undefined
  _unconfirmed?: boolean | undefined
}

/** A normalized TRON contract event. */
export type TronEvent = {
  /** Block the event was emitted in. */
  blockNumber: number
  /** Block timestamp in milliseconds. */
  blockTimestamp: bigint
  /** The emitting contract (Base58Check). */
  contractAddress: Address
  /** The calling contract, when the emitter was called by another (Base58Check). */
  callerContractAddress?: Address | undefined
  /** The event name (e.g. `Transfer`). */
  eventName: string
  /** The event's index within its transaction. */
  eventIndex: number
  /** The transaction that emitted the event. */
  transactionId: string
  /**
   * Decoded parameters keyed by name, normalized to TRON/JS types: `address` →
   * Base58Check, `uint*`/`int*`/`trcToken` → `bigint`, `bool` → `boolean`,
   * others pass through as returned.
   */
  args: Record<string, unknown>
  /** The full event signature string, when provided (e.g. `Transfer(address,...)`). */
  signature?: string | undefined
  /** `true` when the event comes from an unconfirmed (non-solidified) block. */
  unconfirmed: boolean
}

/** Ensures an address-typed value is `0x`-prefixed hex before Base58 conversion. */
function asHex(value: unknown): Hex {
  const s = String(value)
  return (s.startsWith('0x') ? s : `0x${s}`) as Hex
}

/** Converts one decoded parameter value from TronGrid to its TRON/JS type. */
function convertValue(type: string, value: unknown): unknown {
  if (value === null || value === undefined) return value
  const t = type.toLowerCase()

  // Arrays: convert element-wise over the base type (best-effort for `T[]`).
  if (t.endsWith(']') && Array.isArray(value)) {
    const base = t.replace(/\[\d*\]$/, '')
    return value.map((item) => convertValue(base, item))
  }
  if (t.startsWith('address')) return toBase58(asHex(value) as AddressInput)
  if (/^(uint|int|trctoken)/.test(t)) return BigInt(value as string | number)
  if (t.startsWith('bool')) return value === true || value === 'true'
  return value
}

/**
 * Normalizes a raw TronGrid event entry into a {@link TronEvent}: camelCases the
 * fields, converts `block_timestamp` to `bigint`, `contract_address` /
 * `caller_contract_address` to Base58Check, and decodes each parameter in
 * `result` to its TRON/JS type using `result_type`. When `result_type` is
 * absent, named (non-positional) values in `result` are passed through as-is.
 *
 * @param raw The event entry from a TronGrid `/v1/*` response's `data` array.
 * @returns The normalized {@link TronEvent}.
 */
export function formatEvent(raw: RawTronEvent): TronEvent {
  const result = raw.result ?? {}
  const resultType = raw.result_type ?? {}
  const args: Record<string, unknown> = {}

  const typeNames = Object.keys(resultType)
  if (typeNames.length > 0)
    for (const name of typeNames)
      args[name] = convertValue(resultType[name] as string, result[name])
  // Fallback: no types — keep the named (non-positional) values verbatim.
  else
    for (const [name, value] of Object.entries(result))
      if (!/^\d+$/.test(name)) args[name] = value

  return {
    blockNumber: Number(raw.block_number ?? 0),
    blockTimestamp: BigInt(raw.block_timestamp ?? 0),
    // The null address — '' is not a valid address form.
    contractAddress: toBase58(
      (raw.contract_address ??
        '410000000000000000000000000000000000000000') as AddressInput,
    ),
    ...(raw.caller_contract_address
      ? {
          callerContractAddress: toBase58(
            raw.caller_contract_address as AddressInput,
          ),
        }
      : {}),
    eventName: raw.event_name ?? '',
    eventIndex: Number(raw.event_index ?? 0),
    transactionId: raw.transaction_id ?? '',
    args,
    ...(raw.event ? { signature: raw.event } : {}),
    unconfirmed: raw._unconfirmed === true,
  }
}

/** The paging metadata a TronGrid list response carries in `meta`. */
export type EventPageMeta = {
  /** Opaque cursor for the next page (present only while more pages remain). */
  fingerprint?: string | undefined
  /** Number of entries in this page. */
  pageSize?: number | undefined
  /** Server timestamp (ms) the page was produced at. */
  at?: number | undefined
}

/** A raw TronGrid list response envelope. */
export type RawEventResponse = {
  data?: RawTronEvent[] | undefined
  success?: boolean | undefined
  error?: string | undefined
  meta?: { fingerprint?: string; page_size?: number; at?: number } | undefined
}

/** Normalizes a TronGrid `meta` object into an {@link EventPageMeta}. */
export function formatEventMeta(meta: RawEventResponse['meta']): EventPageMeta {
  return {
    ...(meta?.fingerprint ? { fingerprint: meta.fingerprint } : {}),
    ...(meta?.page_size !== undefined ? { pageSize: meta.page_size } : {}),
    ...(meta?.at !== undefined ? { at: meta.at } : {}),
  }
}
