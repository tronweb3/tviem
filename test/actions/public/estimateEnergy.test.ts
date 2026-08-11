import { expect, test } from 'vitest'
import { estimateEnergy } from '../../../src/actions/public/estimateEnergy.js'
import { createClient } from '../../../src/clients/createClient.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { IntegerOutOfRangeError } from '../../../src/errors/encoding.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import type { Address } from '../../../src/types/address.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

// pk = 1 (permitted trivial key) → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC.
const pk1 = `0x${'0'.repeat(63)}1` as const
const caller = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC' as Address
const pk1Hex = '417e5f4552091a69125d5dfcb7b8c2659029395bdf'
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

  const energy = await client.estimateEnergy({ ...call, account: caller })
  expect(energy).toBe(31895n)

  expect(calls[0]?.node).toBe('full')
  expect(calls[0]?.method).toBe('POST')
  expect(calls[0]?.path).toBe('estimateenergy')
  const body = calls[0]?.body as { owner_address: string; data: string }
  expect(body.owner_address).toBe(pk1Hex)
  expect(body.data.startsWith('a9059cbb')).toBe(true)
})

// Energy depends on the caller's own storage slots, so an estimate for a
// placeholder account is worse than no estimate at all.
test('throws AccountNotFoundError without any account', async () => {
  const { transport, calls } = energyMock()
  const client = createPublicClient({ transport })

  await expect(client.estimateEnergy(call)).rejects.toBeInstanceOf(
    AccountNotFoundError,
  )
  // It throws before touching the node.
  expect(calls).toHaveLength(0)
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

  await client.estimateEnergy({ ...call, account: caller, callValue: 5n })
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
    account: caller,
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
      account: caller,
      callValue: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
    }),
  ).rejects.toBeInstanceOf(IntegerOutOfRangeError)
})

// Absence is contractual (cf. omitting absent addresses instead of defaulting):
// an unset param must leave its key out of the body, not send a zero.
test('omits call_value + call_token_value + token_id when not passed', async () => {
  const { transport, calls } = energyMock()
  const client = createPublicClient({ transport })

  await client.estimateEnergy({ ...call, account: caller })
  const body = calls[0]?.body as Record<string, unknown>
  expect('call_value' in body).toBe(false)
  expect('call_token_value' in body).toBe(false)
  expect('token_id' in body).toBe(false)
})

test('forwards callTokenValue + tokenId as call_token_value + token_id', async () => {
  const { transport, calls } = energyMock()
  const client = createPublicClient({ transport })

  await client.estimateEnergy({
    ...call,
    account: caller,
    callTokenValue: 5n,
    tokenId: 1002000n,
  })
  const body = calls[0]?.body as {
    call_token_value?: number
    token_id?: number
  }
  expect(body.call_token_value).toBe(5)
  expect(body.token_id).toBe(1002000)
})

test('rejects a callTokenValue beyond the JSON-safe integer range (K2)', async () => {
  const { transport } = energyMock()
  const client = createPublicClient({ transport })

  await expect(
    client.estimateEnergy({
      ...call,
      account: caller,
      callTokenValue: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
      tokenId: 1002000n,
    }),
  ).rejects.toBeInstanceOf(IntegerOutOfRangeError)
})

test('rejects a tokenId beyond the JSON-safe integer range (K2)', async () => {
  const { transport } = energyMock()
  const client = createPublicClient({ transport })

  await expect(
    client.estimateEnergy({
      ...call,
      account: caller,
      callTokenValue: 5n,
      tokenId: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
    }),
  ).rejects.toBeInstanceOf(IntegerOutOfRangeError)
})
