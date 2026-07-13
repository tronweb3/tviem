// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { Abi, ExtractAbiEventNames } from 'abitype'
import type { Client } from '../../clients/createClient.js'
import type { AddressInput } from '../../types/address.js'
import { getAction } from '../../utils/getAction.js'
import type { EventPageMeta, TronEvent } from '../utils/formatEvent.js'
import {
  type EventOrderBy,
  getEventsByContractAddress,
} from './getEventsByContractAddress.js'

/** The event names of an ABI (or `string` when the ABI is the wide `Abi`). */
type EventNameOf<abi extends Abi | readonly unknown[]> = abi extends Abi
  ? Abi extends abi
    ? string
    : ExtractAbiEventNames<abi>
  : string

export type GetContractEventsParameters<
  abi extends Abi | readonly unknown[] = Abi,
  eventName extends EventNameOf<abi> | undefined = EventNameOf<abi> | undefined,
> = {
  /** The contract ABI — powers `eventName` inference. */
  abi: abi
  /** The contract to read events from (any accepted address form). */
  address: AddressInput
  /** Filter by event name (autocompleted from `abi`). */
  eventName?: eventName | undefined
  /**
   * Inclusive lower bound on block timestamp (ms). TRON has no `eth_getLogs`
   * block-range filter, so events are windowed by time (or a single block).
   */
  fromTimestamp?: number | bigint | undefined
  /** Upper bound on block timestamp (ms). */
  toTimestamp?: number | bigint | undefined
  /** Restrict to a single block height. */
  blockNumber?: number | bigint | undefined
  /** Return only confirmed (solidified) events. */
  onlyConfirmed?: boolean | undefined
  /** Return only unconfirmed events. */
  onlyUnconfirmed?: boolean | undefined
  /** Sort order. @default 'block_timestamp,desc' (TronGrid default). */
  orderBy?: EventOrderBy | undefined
  /** Pagination cursor from a previous response's `meta.fingerprint`. */
  fingerprint?: string | undefined
  /** Page size. @default 20 (TronGrid), max 200. */
  limit?: number | undefined
}

export type GetContractEventsReturnType = {
  events: TronEvent[]
  meta: EventPageMeta
}

/**
 * Reads a contract's events with ABI-driven `eventName` inference — the
 * TRON-native counterpart to viem's `getContractEvents`. It resolves through
 * {@link getEventsByContractAddress} against the TronGrid `/v1` index.
 *
 * Protocol difference from viem: TRON's event index has no `fromBlock`/`toBlock`
 * block-range filter, so the window is expressed with `fromTimestamp` /
 * `toTimestamp` (ms) or a single `blockNumber`. Parameters are decoded by
 * TronGrid; `args` are normalized (addresses → Base58Check, integers → bigint).
 *
 * @param client The Client to use.
 * @param parameters `abi`, `address` and optional `eventName` / window / paging.
 * @returns `{ events, meta }`.
 */
export function getContractEvents<
  const abi extends Abi | readonly unknown[],
  eventName extends EventNameOf<abi> | undefined = undefined,
>(
  client: Client,
  parameters: GetContractEventsParameters<abi, eventName>,
): Promise<GetContractEventsReturnType> {
  return getAction(
    client,
    getEventsByContractAddress,
    'getEventsByContractAddress',
  )({
    address: parameters.address,
    eventName: parameters.eventName as string | undefined,
    blockNumber: parameters.blockNumber,
    onlyConfirmed: parameters.onlyConfirmed,
    onlyUnconfirmed: parameters.onlyUnconfirmed,
    minBlockTimestamp: parameters.fromTimestamp,
    maxBlockTimestamp: parameters.toTimestamp,
    orderBy: parameters.orderBy,
    fingerprint: parameters.fingerprint,
    limit: parameters.limit,
  })
}
