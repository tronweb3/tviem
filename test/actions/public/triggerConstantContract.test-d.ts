import { expectTypeOf, test } from 'vitest'
import { readContract } from '../../../src/actions/public/readContract.js'
import { triggerConstantContract } from '../../../src/actions/public/triggerConstantContract.js'
import type { Client } from '../../../src/clients/createClient.js'
import type { PublicClient } from '../../../src/clients/createPublicClient.js'
import type { Address } from '../../../src/types/address.js'

const client = {} as Client
const publicClient = {} as PublicClient
const address = 'T...' as Address

/** Overloaded, and one overload takes no arguments. */
const overloadedAbi = [
  {
    type: 'function',
    name: 'foo',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'foo',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'string' }],
  },
] as const

/** Overloaded with no zero-argument overload. */
const overloadedNoNullaryAbi = [
  {
    type: 'function',
    name: 'bar',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'a', type: 'address' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'bar',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'a', type: 'address' },
      { name: 'b', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const plainAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

test('a non-overloaded function returns its declared output type', async () => {
  const { result } = await triggerConstantContract(client, {
    address,
    abi: plainAbi,
    functionName: 'balanceOf',
    args: [address],
  })
  expectTypeOf(result).toEqualTypeOf<bigint>()
})

// The action must narrow overloads by the args actually passed, exactly as
// `readContract` does — without the `args` generic threaded through the return
// type, `args` defaults to the union of every overload's tuple and the result
// silently resolves to the nullary overload's output (or collapses to
// `unknown` when there is no nullary overload).
test('overloads narrow by the args passed, like readContract', async () => {
  expectTypeOf(
    await readContract(client, {
      address,
      abi: overloadedAbi,
      functionName: 'foo',
      args: [address],
    }),
  ).toEqualTypeOf<string>()

  const { result } = await triggerConstantContract(client, {
    address,
    abi: overloadedAbi,
    functionName: 'foo',
    args: [address],
  })
  expectTypeOf(result).toEqualTypeOf<string>()

  const { result: nullary } = await triggerConstantContract(client, {
    address,
    abi: overloadedAbi,
    functionName: 'foo',
  })
  expectTypeOf(nullary).toEqualTypeOf<bigint>()
})

test('overloads narrow when no nullary overload exists', async () => {
  const { result } = await triggerConstantContract(client, {
    address,
    abi: overloadedNoNullaryAbi,
    functionName: 'bar',
    args: [address],
  })
  expectTypeOf(result).toEqualTypeOf<string>()

  const { result: two } = await triggerConstantContract(client, {
    address,
    abi: overloadedNoNullaryAbi,
    functionName: 'bar',
    args: [address, address],
  })
  expectTypeOf(two).toEqualTypeOf<boolean>()
})

test('the decorated client narrows overloads the same way', async () => {
  const { result } = await publicClient.triggerConstantContract({
    address,
    abi: overloadedAbi,
    functionName: 'foo',
    args: [address],
  })
  expectTypeOf(result).toEqualTypeOf<string>()
})

test('energyUsed is always bigint', async () => {
  const { energyUsed } = await triggerConstantContract(client, {
    address,
    abi: plainAbi,
    functionName: 'balanceOf',
    args: [address],
  })
  expectTypeOf(energyUsed).toEqualTypeOf<bigint>()
})
