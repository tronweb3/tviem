// Type-surface tests for the function-call codecs (Track C):
// `encodeFunctionData` (functionName / args inference) and
// `decodeFunctionResult` (single / multiple / empty outputs → void).
import { expectTypeOf, test } from 'vitest'

import type { Address } from '../../../src/types/address.js'
import type { Hex } from '../../../src/types/misc.js'
import { decodeFunctionResult } from '../../../src/utils/abi/decodeFunctionResult.js'
import { encodeFunctionData } from '../../../src/utils/abi/encodeFunctionData.js'

// A single `as const` TRC20-flavored ABI drives every inference below.
const trc20Abi = [
  {
    inputs: [],
    name: 'name',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getReserves',
    outputs: [{ type: 'uint256' }, { type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'burn',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

test('encodeFunctionData: functionName is inferred from the abi', () => {
  // a valid name + matching args compiles
  encodeFunctionData({
    abi: trc20Abi,
    functionName: 'transfer',
    args: ['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 1000000n],
  })
  encodeFunctionData({
    abi: trc20Abi,
    functionName: 'balanceOf',
    args: ['TR7'],
  })
  encodeFunctionData({ abi: trc20Abi, functionName: 'name' })

  // @ts-expect-error `doesNotExist` is not a function on this abi
  encodeFunctionData({ abi: trc20Abi, functionName: 'doesNotExist', args: [] })

  // return type is calldata (Hex)
  expectTypeOf(
    encodeFunctionData({ abi: trc20Abi, functionName: 'decimals' }),
  ).toEqualTypeOf<Hex>()
})

test('encodeFunctionData: args are intentionally loose', () => {
  // NOTE: `EncodeFunctionDataParameters.args` is `allArgs | readonly unknown[]`,
  // so args are NOT arity/type-checked against the resolved function. Both of
  // these compile even though they do not match `transfer(address,uint256)`.
  // (Documented as an observation in the return; not a regression to fix here.)
  encodeFunctionData({ abi: trc20Abi, functionName: 'transfer', args: [] })
  encodeFunctionData({
    abi: trc20Abi,
    functionName: 'transfer',
    args: [1, 2, 3],
  })
})

test('decodeFunctionResult: a single output unwraps to that value', () => {
  expectTypeOf(
    decodeFunctionResult({
      abi: trc20Abi,
      functionName: 'balanceOf',
      data: '0x',
    }),
  ).toEqualTypeOf<bigint>()

  expectTypeOf(
    decodeFunctionResult({ abi: trc20Abi, functionName: 'name', data: '0x' }),
  ).toEqualTypeOf<string>()

  expectTypeOf(
    decodeFunctionResult({
      abi: trc20Abi,
      functionName: 'transfer',
      data: '0x',
    }),
  ).toEqualTypeOf<boolean>()

  // An `address` output types as the canonical TRON Base58 (`T…`) form,
  // matching what the runtime `decodeFunctionResult` actually yields.
  expectTypeOf(
    decodeFunctionResult({ abi: trc20Abi, functionName: 'owner', data: '0x' }),
  ).toEqualTypeOf<Address>()

  // Every integer width (including ≤ 48 bits like `uint8`) types as `bigint`,
  // matching the runtime decoder which returns `bigint` for every width.
  expectTypeOf(
    decodeFunctionResult({
      abi: trc20Abi,
      functionName: 'decimals',
      data: '0x',
    }),
  ).toEqualTypeOf<bigint>()
})

test('decodeFunctionResult: multiple outputs return a positional tuple', () => {
  expectTypeOf(
    decodeFunctionResult({
      abi: trc20Abi,
      functionName: 'getReserves',
      data: '0x',
    }),
  ).toEqualTypeOf<readonly [bigint, boolean]>()
})

test('decodeFunctionResult: empty outputs resolve to void', () => {
  expectTypeOf(
    decodeFunctionResult({ abi: trc20Abi, functionName: 'burn', data: '0x' }),
  ).toEqualTypeOf<void>()
})
