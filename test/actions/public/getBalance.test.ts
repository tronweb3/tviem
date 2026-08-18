import { expect, test } from 'vitest'
import { getBalance } from '../../../src/actions/public/getBalance.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { http } from '../../../src/clients/transports/http.js'
import { IntegerOutOfRangeError } from '../../../src/errors/encoding.js'
import { rpc, rpcReq } from '../../fixtures/rpc/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

test('sends the 41-hex address to the FullNode getaccount and decodes SUN', async () => {
  const { transport, calls, bodyOf } = createMockTransport({
    responses: { getaccount: { response: rpc('getaccount') } },
  })
  const client = createPublicClient({ transport })

  const balance = await client.getBalance({
    address: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC',
  })
  expect(balance).toBe(1234567890n)

  // sent-right: full node, correct path/method, Base58 -> 41-hex body.
  expect(calls[0]?.node).toBe('full')
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

// Balances past 2^53-1 SUN (~9M TRX — exchange scale) must
// survive exactly. End-to-end through the REAL http transport: the mock
// transport serves JS objects and cannot express this wire-text hazard.
test('a balance past 2^53 survives exactly through the http transport', async () => {
  const fetchFn = (async () =>
    new Response('{"balance":9007199254740993}')) as typeof fetch
  const transport = http('https://node.example', { fetchFn })
  const client = createPublicClient({ transport })
  expect(
    await client.getBalance({ address: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC' }),
  ).toBe(9007199254740993n)
})

// Legacy-engine guard: if an unsafe number still reaches the action (no
// reviver source access), it has ALREADY lost precision — refuse loudly
// instead of returning a corrupted bigint.
test('an unsafe numeric balance is refused, not silently corrupted', async () => {
  const { transport } = createMockTransport({
    responses: { getaccount: { response: { balance: 2 ** 53 } } },
  })
  const client = createPublicClient({ transport })
  await expect(
    client.getBalance({ address: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC' }),
  ).rejects.toBeInstanceOf(IntegerOutOfRangeError)
})

// The balance reads the FullNode's latest state by default; confirmed: true
// reads the SolidityNode's solidified state instead.
test('confirmed: true reads the balance from the SolidityNode', async () => {
  const { transport, calls } = createMockTransport({
    responses: { getaccount: { response: { balance: 42 } } },
  })
  const client = createPublicClient({ transport })

  await client.getBalance({
    address: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC',
    confirmed: true,
  })
  expect(calls[0]?.node).toBe('solidity')
})
