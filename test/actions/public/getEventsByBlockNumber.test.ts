import { expect, test } from 'vitest'
import { getEventsByBlockNumber } from '../../../src/actions/public/getEventsByBlockNumber.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

test('reads a block’s events with paging from /v1/blocks/{n}/events', async () => {
  const { transport, calls } = createMockTransport({
    responses: {},
    onUnmatched: {
      response: {
        data: [
          {
            event_name: 'Transfer',
            contract_address: 'TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe',
          },
        ],
        success: true,
        meta: { fingerprint: 'fp', page_size: 1 },
      },
    },
  })
  const client = createPublicClient({ transport })

  const { events, meta } = await getEventsByBlockNumber(client, {
    blockNumber: 84_423_283,
    onlyConfirmed: true,
    limit: 50,
    fingerprint: 'prev',
  })
  expect(events).toHaveLength(1)
  expect(meta.fingerprint).toBe('fp')
  const call = calls[0]
  expect(call?.node).toBe('event')
  expect(call?.path).toContain('/v1/blocks/84423283/events')
  expect(call?.path).toContain('only_confirmed=true')
  expect(call?.path).toContain('limit=50')
  expect(call?.path).toContain('fingerprint=prev')
})
