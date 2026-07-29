/**
 * TRON chain definition types. The EVM `Chain` notion of a single flat RPC
 * URL group is replaced by TRON's dual-node model (`full` / `solidity`), the
 * native currency is pinned to TRX (6 decimals), and EVM-only fields
 * (formatters / fees / serializers / block explorers / ENS) are dropped.
 */

import type { Address } from './address.js'
import type { Assign } from './utils.js'

/**
 * TRON native currency. Always TRX with 6 decimals (1 TRX = 1e6 SUN).
 */
export type TronNativeCurrency = {
  /** Human-readable name, e.g. `'TRON'`. */
  name: string
  /** Ticker symbol, e.g. `'TRX'`. */
  symbol: string
  /** Fixed at 6 (SUN precision). */
  decimals: 6
}

/**
 * A single TRON node endpoint (a list of interchangeable HTTP hosts).
 */
export type TronRpcEndpoint = {
  /** HTTP host base URLs (without a `/wallet` | `/walletsolidity` prefix). */
  http: readonly string[]
}

/**
 * A TRON RPC endpoint group.
 *
 * TRON exposes two node roles on (usually) the same host:
 * - `full` — FullNode (`/wallet/*`), latest / unconfirmed state and broadcast.
 * - `solidity` — SolidityNode (`/walletsolidity/*`), confirmed read-only state.
 *
 * `event` is reserved for a TronGrid-style `/v1/*` event index host.
 */
export type TronRpcUrls = {
  /** FullNode endpoint (`/wallet/*`). */
  full: TronRpcEndpoint
  /** SolidityNode endpoint (`/walletsolidity/*`). */
  solidity: TronRpcEndpoint
  /** Event index endpoint (reserved). */
  event?: TronRpcEndpoint | undefined
}

/**
 * A known on-chain contract entry (reserved for a per-chain contract table).
 */
export type TronContract = {
  address: Address
  /** Block the contract was created at. */
  blockCreated?: number | undefined
}

/**
 * Optional chain configuration carried alongside the core {@link Chain} fields.
 * The EVM `formatters` / `fees` / `serializers` are intentionally omitted.
 */
export type ChainConfig<
  extendSchema extends Record<string, unknown> | undefined =
    | Record<string, unknown>
    | undefined,
> = {
  /** Custom chain data. @deprecated use `.extend` instead. */
  custom?: extendSchema | undefined
  /** Schema describing the shape accepted by `.extend`. */
  extendSchema?: extendSchema | undefined
}

/**
 * A TRON chain definition.
 *
 * @example
 * ```ts
 * const nile: Chain = {
 *   id: 3448148188,
 *   name: 'Tron Nile Testnet',
 *   nativeCurrency: { name: 'TRON', symbol: 'TRX', decimals: 6 },
 *   rpcUrls: {
 *     default: {
 *       full: { http: ['https://api.nileex.io'] },
 *       solidity: { http: ['https://api.nileex.io'] },
 *     },
 *   },
 *   blockTime: 3000,
 *   testnet: true,
 * }
 * ```
 */
export type Chain<
  extendSchema extends Record<string, unknown> | undefined =
    | Record<string, unknown>
    | undefined,
> = {
  /** Chain ID (the last 4 bytes of the genesis block hash, as a signed int). */
  id: number
  /** Human-readable name. */
  name: string
  /** Native currency (always TRX, 6 decimals). */
  nativeCurrency: TronNativeCurrency
  /** Collection of RPC endpoint groups keyed by name (must include `default`). */
  rpcUrls: {
    [key: string]: TronRpcUrls
    default: TronRpcUrls
  }
  /** Nominal block time in milliseconds. */
  blockTime?: number | undefined
  /** Flag for test networks. */
  testnet?: boolean | undefined
  /** Collection of known contracts (reserved). */
  contracts?:
    | {
        [key: string]: TronContract | undefined
      }
    | undefined
} & ChainConfig<extendSchema>

/** Merge a chain with an `.extend` overlay, preferring the overlay's fields. */
export type ExtendChain<
  chain extends Chain,
  extended extends Record<string, unknown>,
> = Assign<chain, extended>
