import { expect, test } from 'vitest'
import { createMockTransport } from '../../../test/mock/createMockTransport.js'
import { createClient } from '../../clients/createClient.js'
import { createPublicClient } from '../../clients/createPublicClient.js'
import type { Address } from '../../types/address.js'
import { estimateEnergy } from './estimateEnergy.js'

// pk = 1 (permitted trivial key) → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC.
const pk1 = `0x${'0'.repeat(63)}1` as const
const pk1Hex = '417e5f4552091a69125d5dfcb7b8c2659029395bdf'
const zeroHex = '410000000000000000000000000000000000000000'
const contract = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' as Address

const trc20Abi = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const okResponse = {
  result: { result: true },
  constant_result: [
    '0000000000000000000000000000000000000000000000000000000000000001',
  ],
  energy_used: 31895,
}

const call = {
  address: contract,
  abi: trc20Abi,
  functionName: 'transfer',
  args: [contract, 1000000n],
} as const

function energyMock() {
  return createMockTransport({
    responses: { triggerconstantcontract: { response: okResponse } },
  })
}

test('returns energy_used as a bigint with the per-call caller owner_address', async () => {
  const { transport, calls } = energyMock()
  const client = createPublicClient({ transport })

  const energy = await client.estimateEnergy({ ...call, account: pk1 })
  expect(energy).toBe(31895n)

  expect(calls[0]?.node).toBe('full')
  expect(calls[0]?.method).toBe('POST')
  expect(calls[0]?.path).toBe('triggerconstantcontract')
  const body = calls[0]?.body as { owner_address: string; data: string }
  expect(body.owner_address).toBe(pk1Hex)
  expect(body.data.startsWith('a9059cbb')).toBe(true)
})

test('falls back to the zero address without any account', async () => {
  const { transport, calls } = energyMock()
  const client = createPublicClient({ transport })

  await client.estimateEnergy(call)
  expect((calls[0]?.body as { owner_address: string }).owner_address).toBe(
    zeroHex,
  )
})

test('falls back to the hoisted client account (bare action)', async () => {
  const { transport, calls } = energyMock()
  const client = createClient({ transport, account: pk1 })

  await estimateEnergy(client, call)
  expect((calls[0]?.body as { owner_address: string }).owner_address).toBe(
    pk1Hex,
  )
})

test('forwards callValue as call_value', async () => {
  const { transport, calls } = energyMock()
  const client = createPublicClient({ transport })

  await client.estimateEnergy({ ...call, account: pk1, callValue: 5n })
  expect((calls[0]?.body as { call_value?: number }).call_value).toBe(5)
})
