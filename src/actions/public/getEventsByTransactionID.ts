import type { Client } from '../../clients/createClient.js'
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { EventPageMeta, TronEvent } from '../utils/formatEvent.js'
import {
  type RequestEventsErrorType,
  requestEvents,
} from '../utils/requestEvents.js'

export type GetEventsByTransactionIDParameters = {
  /** The transaction id (64 hex chars, no `0x`). */
  txID: string
  /** Return only confirmed events. */
  onlyConfirmed?: boolean | undefined
  /** Return only unconfirmed events. */
  onlyUnconfirmed?: boolean | undefined
  /** Page size. @default 20 (TronGrid), max 200. */
  limit?: number | undefined
  /** Pagination cursor from a previous response's `meta.fingerprint`. */
  fingerprint?: string | undefined
}

export type GetEventsByTransactionIDReturnType = {
  events: TronEvent[]
  meta: EventPageMeta
}

export type GetEventsByTransactionIDErrorType =
  | BaseErrorType
  | RequestEventsErrorType
  | ErrorType

/**
 * Reads events a transaction emitted, from the TronGrid
 * `/v1/transactions/{txID}/events` index (the `event` node). Results are
 * paginated — continue with the returned `meta.fingerprint` until it is absent.
 *
 * @param client The Client to use.
 * @param parameters `txID` and optional confirmed/unconfirmed filter / paging.
 * @returns `{ events, meta }` (whose `fingerprint` continues pagination).
 */
export async function getEventsByTransactionID(
  client: Client,
  parameters: GetEventsByTransactionIDParameters,
): Promise<GetEventsByTransactionIDReturnType> {
  const txID = parameters.txID.replace(/^0x/, '')
  if (!/^[0-9a-fA-F]{64}$/.test(txID))
    throw new BaseError(
      `Invalid transaction id: "${parameters.txID}". Expected 64 hex characters.`,
    )
  return requestEvents(client, {
    path: `/v1/transactions/${txID}/events`,
    query: {
      only_confirmed: parameters.onlyConfirmed,
      only_unconfirmed: parameters.onlyUnconfirmed,
      limit: parameters.limit,
      fingerprint: parameters.fingerprint,
    },
  })
}
