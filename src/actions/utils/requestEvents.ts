import type { Client } from '../../clients/createClient.js'
import type { RequestErrorType } from '../../clients/transports/http.js'
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { ToBase58ErrorType } from '../../utils/address/toBase58.js'
import {
  type EventPageMeta,
  formatEvent,
  formatEventMeta,
  type RawEventResponse,
  type TronEvent,
} from './formatEvent.js'

/** A TronGrid query string, before `undefined` values are dropped. */
export type EventQuery = Record<
  string,
  string | number | bigint | boolean | undefined
>

/** Serializes a query object to a `?a=b&c=d` suffix, omitting `undefined`. */
export function toQueryString(query: EventQuery): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query))
    if (value !== undefined) params.set(key, String(value))
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ''
}

export type RequestEventsErrorType =
  | BaseErrorType
  | RequestErrorType
  // formatEvent renders contract/caller/parameter addresses via toBase58.
  | ToBase58ErrorType
  | ErrorType

/**
 * Issues a TronGrid `/v1/*` event read over the `event` node, guards the
 * `{ success: false }` shape, and normalizes the `data` array + `meta` into
 * {@link TronEvent}s. All event read actions funnel through here.
 *
 * @param client The Client to use.
 * @param request `path` — the `/v1/...` endpoint; `query` — the filter params.
 * @returns `{ events, meta }` with the events normalized.
 */
export async function requestEvents(
  client: Client,
  { path, query }: { path: string; query: EventQuery },
): Promise<{ events: TronEvent[]; meta: EventPageMeta }> {
  const response = await client.request<RawEventResponse>({
    node: 'event',
    path: `${path}${toQueryString(query)}`,
    method: 'GET',
  })
  if (response.success === false)
    throw new BaseError(
      response.error ?? 'The event server rejected the request.',
    )
  return {
    events: (response.data ?? []).map(formatEvent),
    meta: formatEventMeta(response.meta),
  }
}
