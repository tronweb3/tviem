import { expect, test } from 'vitest'
import { createMockTransport } from '../../../test/mock/createMockTransport.js'
import { createPublicClient } from '../../clients/createPublicClient.js'
import { getEventsOfLatestBlock } from './getEventsOfLatestBlock.js'

test('reads the latest block’s events from /v1/blocks/latest/events', async () => {
  const { transport, calls } = createMockTransport({
    responses: {},
    onUnmatched: {
      response: {
        data: [
          {
            event_name: 'Transfer',
            contract_address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          },
        ],
        success: true,
      },
    },
  })
  const client = createPublicClient({ transport })

  const { events } = await getEventsOfLatestBlock(client, {
    onlyConfirmed: true,
  })
  expect(events).toHaveLength(1)
  const call = calls[0]
  expect(call?.node).toBe('event')
  expect(call?.path).toContain('/v1/blocks/latest/events')
  expect(call?.path).toContain('only_confirmed=true')
})

test('works with no parameters', async () => {
  const { transport, calls } = createMockTransport({
    responses: {},
    onUnmatched: { response: { data: [], success: true } },
  })
  const client = createPublicClient({ transport })
  const { events } = await getEventsOfLatestBlock(client)
  expect(events).toEqual([])
  expect(calls[0]?.path).toBe('/v1/blocks/latest/events')
})
