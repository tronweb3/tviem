// Type-surface tests for the contract-deploy codecs (Track C / increment ①):
// `encodeDeployData` (constructor arg inference → Hex) and `decodeDeployData`.
import type { Abi } from 'abitype'
import { expectTypeOf, test } from 'vitest'

import type { Address } from '../../../src/types/address.js'
import type { Hex } from '../../../src/types/misc.js'
import { decodeDeployData } from '../../../src/utils/abi/decodeDeployData.js'
import { encodeDeployData } from '../../../src/utils/abi/encodeDeployData.js'

const abi = [
  {
    type: 'constructor',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'totalSupply', type: 'uint256' },
      { name: 'owner', type: 'address' },
    ],
  },
] as const

test('encodeDeployData: returns calldata (Hex)', () => {
  expectTypeOf(
    encodeDeployData({ abi, bytecode: '0x60', args: [1n] }),
  ).toEqualTypeOf<Hex>()

  // A constructor-less ABI still compiles when no args are provided.
  encodeDeployData({ abi: [] as const satisfies Abi, bytecode: '0x60' })
})

test('decodeDeployData: returns { args?, bytecode } with brand-out args', () => {
  const result = decodeDeployData({ abi, bytecode: '0x60', data: '0x60' })
  expectTypeOf(result.bytecode).toEqualTypeOf<Hex>()
  // Decoded constructor args brand OUT: uint256 → bigint, address → Base58.
  expectTypeOf(result.args).toEqualTypeOf<
    readonly [bigint, Address] | undefined
  >()
})
