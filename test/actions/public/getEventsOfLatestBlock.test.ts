import { expect, test } from 'vitest'
import { getEventsOfLatestBlock } from '../../../src/actions/public/getEventsOfLatestBlock.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

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

// F-9E2: a busy block emits more than one page — expose limit + the fingerprint
// cursor and return meta, instead of silently dropping later pages.
test('forwards limit + fingerprint and returns the pagination meta', async () => {
  const { transport, calls } = createMockTransport({
    responses: {},
    onUnmatched: {
      response: {
        data: [],
        success: true,
        meta: { fingerprint: 'fp', page_size: 20 },
      },
    },
  })
  const client = createPublicClient({ transport })
  const { meta } = await getEventsOfLatestBlock(client, {
    limit: 200,
    fingerprint: 'prev',
  })
  expect(meta.fingerprint).toBe('fp')
  expect(calls[0]?.path).toContain('limit=200')
  expect(calls[0]?.path).toContain('fingerprint=prev')
})
