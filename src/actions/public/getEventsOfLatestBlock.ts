// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { Client } from '../../clients/createClient.js'
import type { EventPageMeta, TronEvent } from '../utils/formatEvent.js'
import { requestEvents } from '../utils/requestEvents.js'

export type GetEventsOfLatestBlockParameters = {
  /** Return only confirmed events. */
  onlyConfirmed?: boolean | undefined
  /** Page size. @default 20 (TronGrid), max 200. */
  limit?: number | undefined
  /** Pagination cursor from a previous response's `meta.fingerprint`. */
  fingerprint?: string | undefined
}

export type GetEventsOfLatestBlockReturnType = {
  events: TronEvent[]
  meta: EventPageMeta
}

/**
 * Reads events emitted in the latest block, from the TronGrid
 * `/v1/blocks/latest/events` index (the `event` node). Results are paginated —
 * a busy block emits more than one page — so continue with the returned
 * `meta.fingerprint` until it is absent.
 *
 * @param client The Client to use.
 * @param parameters Optional confirmed filter / paging.
 * @returns `{ events, meta }` (whose `fingerprint` continues pagination).
 */
export function getEventsOfLatestBlock(
  client: Client,
  parameters: GetEventsOfLatestBlockParameters = {},
): Promise<GetEventsOfLatestBlockReturnType> {
  return requestEvents(client, {
    path: '/v1/blocks/latest/events',
    query: {
      only_confirmed: parameters.onlyConfirmed,
      limit: parameters.limit,
      fingerprint: parameters.fingerprint,
    },
  })
}
