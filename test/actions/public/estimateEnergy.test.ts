import { expect, test } from 'vitest'
import { estimateEnergy } from '../../../src/actions/public/estimateEnergy.js'
import { createClient } from '../../../src/clients/createClient.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { IntegerOutOfRangeError } from '../../../src/errors/encoding.js'
import type { Address } from '../../../src/types/address.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

// pk = 1 (permitted trivial key) → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC.
const pk1 = `0x${'0'.repeat(63)}1` as const
const pk1Hex = '417e5f4552091a69125d5dfcb7b8c2659029395bdf'
const zeroHex = '410000000000000000000000000000000000000000'
const contract = 'TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe' as Address

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
  energy_required: 31895,
}

const call = {
  address: contract,
  abi: trc20Abi,
  functionName: 'transfer',
  args: [contract, 1000000n],
} as const

function energyMock() {
  return createMockTransport({
    responses: { estimateenergy: { response: okResponse } },
  })
}

test('returns energy_required as a bigint with the per-call caller owner_address', async () => {
  const { transport, calls } = energyMock()
  const client = createPublicClient({ transport })

  const energy = await client.estimateEnergy({ ...call, account: pk1 })
  expect(energy).toBe(31895n)

  expect(calls[0]?.node).toBe('full')
  expect(calls[0]?.method).toBe('POST')
  expect(calls[0]?.path).toBe('estimateenergy')
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

// K2: a call_value past the JSON-safe integer range (2^53-1) would be silently
// rounded by Number() in the request body — reject it instead of estimating
// against a corrupted value.
test('accepts callValue at the JSON-safe integer boundary (K2)', async () => {
  const { transport, calls } = energyMock()
  const client = createPublicClient({ transport })

  await client.estimateEnergy({
    ...call,
    account: pk1,
    callValue: BigInt(Number.MAX_SAFE_INTEGER),
  })
  expect((calls[0]?.body as { call_value?: number }).call_value).toBe(
    Number.MAX_SAFE_INTEGER,
  )
})

test('rejects a callValue beyond the JSON-safe integer range (K2)', async () => {
  const { transport } = energyMock()
  const client = createPublicClient({ transport })

  await expect(
    client.estimateEnergy({
      ...call,
      account: pk1,
      callValue: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
    }),
  ).rejects.toBeInstanceOf(IntegerOutOfRangeError)
})
