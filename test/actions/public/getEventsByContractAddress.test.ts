import { expect, test } from 'vitest'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { getEventsByContractAddress } from '../../../src/actions/public/getEventsByContractAddress.js'

const usdt = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
const usdtHex = '41a614f803b6fd780986a42c78ec9c7f77e6ded13c'

const rawEvent = {
  block_number: 1,
  block_timestamp: 1_700_000_000_000,
  contract_address: usdt,
  event_index: 0,
  event_name: 'Transfer',
  result: {
    from: '0xafb6ccdb345bc36c69a618b66c1693f36213622b',
    to: '0x2e5531459778bee382355ab73bc93ee763f5ed94',
    value: '5',
  },
  result_type: { from: 'address', to: 'address', value: 'uint256' },
  transaction_id: 'ab'.repeat(32),
}

function mock(response: unknown) {
  const { transport, calls } = createMockTransport({
    responses: {},
    onUnmatched: { response },
  })
  return { client: createPublicClient({ transport }), calls }
}

test('reads + normalizes events/meta and builds the /v1 query', async () => {
  const { client, calls } = mock({
    data: [rawEvent],
    success: true,
    meta: { fingerprint: 'fp', page_size: 1, at: 9 },
  })

  const { events, meta } = await getEventsByContractAddress(client, {
    address: usdt,
    eventName: 'Transfer',
    onlyConfirmed: true,
    orderBy: 'block_timestamp,asc',
    minBlockTimestamp: 1000,
    limit: 200,
  })

  expect(events).toHaveLength(1)
  expect(events[0]?.eventName).toBe('Transfer')
  expect(events[0]?.args.value).toBe(5n)
  expect(meta).toEqual({ fingerprint: 'fp', pageSize: 1, at: 9 })

  const call = calls[0]
  expect(call?.node).toBe('event')
  expect(call?.method).toBe('GET')
  expect(call?.path).toContain(`/v1/contracts/${usdt}/events`)
  expect(call?.path).toContain('event_name=Transfer')
  expect(call?.path).toContain('only_confirmed=true')
  expect(call?.path).toContain('order_by=block_timestamp%2Casc')
  expect(call?.path).toContain('min_block_timestamp=1000')
  expect(call?.path).toContain('limit=200')
})

test('accepts a TRON hex address and queries its Base58 form', async () => {
  const { client, calls } = mock({ data: [], success: true })
  await getEventsByContractAddress(client, { address: usdtHex })
  expect(calls[0]?.path).toContain(`/v1/contracts/${usdt}/events`)
})

test('throws when the event server returns success:false', async () => {
  const { client } = mock({ success: false, error: 'bad request' })
  await expect(
    getEventsByContractAddress(client, { address: usdt }),
  ).rejects.toThrow('bad request')
})
