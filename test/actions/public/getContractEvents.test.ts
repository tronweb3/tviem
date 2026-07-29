import { expect, test } from 'vitest'
import { getContractEvents } from '../../../src/actions/public/getContractEvents.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

const usdt = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

const abi = [
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const

test('maps from/toTimestamp to min/max_block_timestamp and filters by eventName', async () => {
  const { transport, calls } = createMockTransport({
    responses: {},
    onUnmatched: {
      response: {
        data: [
          {
            event_name: 'Transfer',
            contract_address: usdt,
            result: {
              from: '0xafb6ccdb345bc36c69a618b66c1693f36213622b',
              to: '0x2e5531459778bee382355ab73bc93ee763f5ed94',
              value: '5',
            },
            result_type: { from: 'address', to: 'address', value: 'uint256' },
          },
        ],
        success: true,
        meta: { page_size: 1 },
      },
    },
  })
  const client = createPublicClient({ transport })

  const { events } = await getContractEvents(client, {
    abi,
    address: usdt,
    eventName: 'Transfer',
    fromTimestamp: 1000,
    toTimestamp: 2000,
    onlyConfirmed: true,
  })

  expect(events).toHaveLength(1)
  expect(events[0]?.args.value).toBe(5n)

  const call = calls[0]
  expect(call?.node).toBe('event')
  expect(call?.path).toContain(`/v1/contracts/${usdt}/events`)
  expect(call?.path).toContain('event_name=Transfer')
  expect(call?.path).toContain('min_block_timestamp=1000')
  expect(call?.path).toContain('max_block_timestamp=2000')
  expect(call?.path).toContain('only_confirmed=true')
})
