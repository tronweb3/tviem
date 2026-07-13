// Type-surface test for `decodeFunctionData` (Track C / increment ①): the
// decoded `args` must brand OUT (TRON `address` → Base58 `Address`, integers →
// `bigint`), matching the runtime — not the wide-in input flavor.
import { expectTypeOf, test } from 'vitest'

import type { Address } from '../../types/address.js'
import { decodeFunctionData } from './decodeFunctionData.js'

const abi = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

test('decodeFunctionData: decoded args brand out to Base58 Address / bigint', () => {
  const result = decodeFunctionData({ abi, data: '0x' })
  expectTypeOf(result.functionName).toEqualTypeOf<'transfer'>()
  expectTypeOf(result.args).toEqualTypeOf<readonly [Address, bigint]>()
})
