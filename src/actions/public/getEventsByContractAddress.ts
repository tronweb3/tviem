import type { Client } from '../../clients/createClient.js'
import type { ErrorType } from '../../errors/utils.js'
import type { AddressInput } from '../../types/address.js'
import {
  type ToBase58ErrorType,
  toBase58,
} from '../../utils/address/toBase58.js'
import type { EventPageMeta, TronEvent } from '../utils/formatEvent.js'
import {
  type RequestEventsErrorType,
  requestEvents,
} from '../utils/requestEvents.js'

/** TronGrid event sort order (only `block_timestamp` is supported). */
export type EventOrderBy = 'block_timestamp,asc' | 'block_timestamp,desc'

export type GetEventsByContractAddressParameters = {
  /** The contract to read events from (any accepted address form). */
  address: AddressInput
  /** Filter by event name (e.g. `Transfer`). */
  eventName?: string | undefined
  /** Restrict to a single block height. */
  blockNumber?: number | bigint | undefined
  /** Return only confirmed (solidified) events. Mutually exclusive with `onlyUnconfirmed`. */
  onlyConfirmed?: boolean | undefined
  /** Return only unconfirmed events. Mutually exclusive with `onlyConfirmed`. */
  onlyUnconfirmed?: boolean | undefined
  /** Inclusive lower bound on `block_timestamp` (ms). */
  minBlockTimestamp?: number | bigint | undefined
  /** Upper bound on `block_timestamp` (ms). */
  maxBlockTimestamp?: number | bigint | undefined
  /** Sort order. @default 'block_timestamp,desc' (TronGrid default). */
  orderBy?: EventOrderBy | undefined
  /** Pagination cursor from a previous response's `meta.fingerprint`. */
  fingerprint?: string | undefined
  /** Page size. @default 20 (TronGrid), max 200. */
  limit?: number | undefined
}

export type GetEventsByContractAddressReturnType = {
  events: TronEvent[]
  meta: EventPageMeta
}

export type GetEventsByContractAddressErrorType =
  | RequestEventsErrorType
  | ToBase58ErrorType
  | ErrorType

/**
 * Reads a contract's events from the TronGrid `/v1/contracts/{address}/events`
 * index (the `event` node). Returns normalized {@link TronEvent}s plus the page
 * `meta` (whose `fingerprint` continues pagination of this snapshot).
 *
 * To tail new events, page ascending with `orderBy: 'block_timestamp,asc'`,
 * `onlyConfirmed: true`, and `minBlockTimestamp` advanced to the last-seen
 * timestamp (deduping events that share that boundary timestamp). Confirmed
 * events lag the chain head by finality (~1 min); the unconfirmed feed is
 * lower-latency but reorg-prone.
 *
 * @param client The Client to use.
 * @param parameters `address` and optional filters/paging.
 * @returns `{ events, meta }`.
 */
export function getEventsByContractAddress(
  client: Client,
  parameters: GetEventsByContractAddressParameters,
): Promise<GetEventsByContractAddressReturnType> {
  const address = toBase58(parameters.address)
  return requestEvents(client, {
    path: `/v1/contracts/${address}/events`,
    query: {
      event_name: parameters.eventName,
      block_number: parameters.blockNumber,
      only_confirmed: parameters.onlyConfirmed,
      only_unconfirmed: parameters.onlyUnconfirmed,
      min_block_timestamp: parameters.minBlockTimestamp,
      max_block_timestamp: parameters.maxBlockTimestamp,
      order_by: parameters.orderBy,
      fingerprint: parameters.fingerprint,
      limit: parameters.limit,
    },
  })
}
