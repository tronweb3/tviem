import { expect, test } from 'vitest'
import { rpc, rpcReq } from '../../../test/fixtures/rpc/loader.js'
import { createMockTransport } from '../../../test/mock/createMockTransport.js'
import { createPublicClient } from '../../clients/createPublicClient.js'
import { getAccountResources } from './getAccountResources.js'

const address = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'

test('sends the 41-hex address to full getaccountresource and maps to bigint', async () => {
  const { transport, calls, bodyOf } = createMockTransport({
    responses: { getaccountresource: { response: rpc('getaccountresource') } },
  })
  const client = createPublicClient({ transport })

  const resources = await client.getAccountResources({ address })

  // sent-right: full node, correct path/method, Base58 -> 41-hex body.
  expect(calls[0]?.node).toBe('full')
  expect(calls[0]?.path).toBe('getaccountresource')
  expect(calls[0]?.method).toBe('POST')
  expect(bodyOf('getaccountresource')).toEqual({
    address: '417e5f4552091a69125d5dfcb7b8c2659029395bdf',
  })
  expect(bodyOf('getaccountresource')).toEqual(
    rpcReq('getaccountresource').body,
  )

  // Every field is bigint; the present fields decode from the fixture and the
  // omitted `freeNetUsed` defaults to 0n.
  expect(resources).toEqual({
    freeNetLimit: 5000n,
    freeNetUsed: 0n,
    netLimit: 1500n,
    netUsed: 200n,
    energyLimit: 1801n,
    energyUsed: 300n,
    tronPowerLimit: 100n,
    tronPowerUsed: 25n,
    totalNetLimit: 43200000000n,
    totalNetWeight: 1234567n,
    totalEnergyLimit: 180000000000n,
    totalEnergyWeight: 9876543n,
  })
})

test('an empty ({}) response maps every field to 0n', async () => {
  const { transport } = createMockTransport({
    responses: { getaccountresource: { response: {} } },
  })
  const client = createPublicClient({ transport })

  const resources = await getAccountResources(client, { address })
  expect(resources).toEqual({
    freeNetLimit: 0n,
    freeNetUsed: 0n,
    netLimit: 0n,
    netUsed: 0n,
    energyLimit: 0n,
    energyUsed: 0n,
    tronPowerLimit: 0n,
    tronPowerUsed: 0n,
    totalNetLimit: 0n,
    totalNetWeight: 0n,
    totalEnergyLimit: 0n,
    totalEnergyWeight: 0n,
  })
})
