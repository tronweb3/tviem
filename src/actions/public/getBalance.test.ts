import { expect, test } from 'vitest'
import { rpc, rpcReq } from '../../../test/fixtures/rpc/loader.js'
import { createMockTransport } from '../../../test/mock/createMockTransport.js'
import { createPublicClient } from '../../clients/createPublicClient.js'
import { getBalance } from './getBalance.js'

test('sends the 41-hex address to solidity getaccount and decodes SUN', async () => {
  const { transport, calls, bodyOf } = createMockTransport({
    responses: { getaccount: { response: rpc('getaccount') } },
  })
  const client = createPublicClient({ transport })

  const balance = await client.getBalance({
    address: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC',
  })
  expect(balance).toBe(1234567890n)

  // sent-right: solidity node, correct path/method, Base58 -> 41-hex body.
  expect(calls[0]?.node).toBe('solidity')
  expect(calls[0]?.path).toBe('getaccount')
  expect(calls[0]?.method).toBe('POST')
  expect(bodyOf('getaccount')).toEqual({
    address: '417e5f4552091a69125d5dfcb7b8c2659029395bdf',
  })
  expect(bodyOf('getaccount')).toEqual(rpcReq('getaccount').body)
})

test('a non-existent account ({}) maps to 0n without asserting success', async () => {
  const { transport } = createMockTransport({
    responses: { getaccount: { response: {} } },
  })
  const client = createPublicClient({ transport })

  const balance = await client.getBalance({
    address: 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
  })
  expect(balance).toBe(0n)
})

test('is callable as a bare action with an explicit client', async () => {
  const { transport } = createMockTransport({
    responses: { getaccount: { response: { balance: 42 } } },
  })
  const client = createPublicClient({ transport })
  expect(
    await getBalance(client, {
      address: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC',
    }),
  ).toBe(42n)
})
