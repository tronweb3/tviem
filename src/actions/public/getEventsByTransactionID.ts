// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { Client } from '../../clients/createClient.js'
import { BaseError } from '../../errors/base.js'
import type { TronEvent } from '../utils/formatEvent.js'
import { requestEvents } from '../utils/requestEvents.js'

export type GetEventsByTransactionIDParameters = {
  /** The transaction id (64 hex chars, no `0x`). */
  txID: string
  /** Return only confirmed events. */
  onlyConfirmed?: boolean | undefined
  /** Return only unconfirmed events. */
  onlyUnconfirmed?: boolean | undefined
}

export type GetEventsByTransactionIDReturnType = { events: TronEvent[] }

/**
 * Reads every event a transaction emitted, from the TronGrid
 * `/v1/transactions/{txID}/events` index (the `event` node).
 *
 * @param client The Client to use.
 * @param parameters `txID` and optional confirmed/unconfirmed filter.
 * @returns `{ events }`.
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
  const { events } = await requestEvents(client, {
    path: `/v1/transactions/${txID}/events`,
    query: {
      only_confirmed: parameters.onlyConfirmed,
      only_unconfirmed: parameters.onlyUnconfirmed,
    },
  })
  return { events }
}
