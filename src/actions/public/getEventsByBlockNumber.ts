import type { Client } from '../../clients/createClient.js'
import type { ErrorType } from '../../errors/utils.js'
import type { EventPageMeta, TronEvent } from '../utils/formatEvent.js'
import {
  type RequestEventsErrorType,
  requestEvents,
} from '../utils/requestEvents.js'

export type GetEventsByBlockNumberParameters = {
  /** The block height to read events from. */
  blockNumber: number | bigint
  /** Return only confirmed events. */
  onlyConfirmed?: boolean | undefined
  /** Page size. @default 20 (TronGrid), max 200. */
  limit?: number | undefined
  /** Pagination cursor from a previous response's `meta.fingerprint`. */
  fingerprint?: string | undefined
}

export type GetEventsByBlockNumberReturnType = {
  events: TronEvent[]
  meta: EventPageMeta
}

export type GetEventsByBlockNumberErrorType = RequestEventsErrorType | ErrorType

/**
 * Reads every event emitted in a block, from the TronGrid
 * `/v1/blocks/{blockNumber}/events` index (the `event` node).
 *
 * @param client The Client to use.
 * @param parameters `blockNumber` and optional confirmed filter / paging.
 * @returns `{ events, meta }`.
 */
export function getEventsByBlockNumber(
  client: Client,
  parameters: GetEventsByBlockNumberParameters,
): Promise<GetEventsByBlockNumberReturnType> {
  return requestEvents(client, {
    path: `/v1/blocks/${parameters.blockNumber}/events`,
    query: {
      only_confirmed: parameters.onlyConfirmed,
      limit: parameters.limit,
      fingerprint: parameters.fingerprint,
    },
  })
}
