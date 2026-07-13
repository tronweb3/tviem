// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { Client } from '../../clients/createClient.js'
import type { TronEvent } from '../utils/formatEvent.js'
import { requestEvents } from '../utils/requestEvents.js'

export type GetEventsOfLatestBlockParameters = {
  /** Return only confirmed events. */
  onlyConfirmed?: boolean | undefined
}

export type GetEventsOfLatestBlockReturnType = { events: TronEvent[] }

/**
 * Reads every event emitted in the latest block, from the TronGrid
 * `/v1/blocks/latest/events` index (the `event` node).
 *
 * @param client The Client to use.
 * @param parameters Optional confirmed filter.
 * @returns `{ events }`.
 */
export async function getEventsOfLatestBlock(
  client: Client,
  parameters: GetEventsOfLatestBlockParameters = {},
): Promise<GetEventsOfLatestBlockReturnType> {
  const { events } = await requestEvents(client, {
    path: '/v1/blocks/latest/events',
    query: { only_confirmed: parameters.onlyConfirmed },
  })
  return { events }
}
