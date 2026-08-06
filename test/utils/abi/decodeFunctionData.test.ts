import type { Abi } from 'abitype'
import { expect, test } from 'vitest'

import { AbiFunctionSignatureNotFoundError } from '../../../src/errors/abi.js'
import { decodeFunctionData } from '../../../src/utils/abi/decodeFunctionData.js'
import { encodeFunctionData } from '../../../src/utils/abi/encodeFunctionData.js'

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
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
] as const satisfies Abi

test('resolves the function by 4-byte selector and decodes its args', () => {
  const data = encodeFunctionData({
    abi,
    functionName: 'transfer',
    args: ['TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe', 1000000n],
  })
  // `transfer(address,uint256)` selector is the canonical 0xa9059cbb.
  expect(data.startsWith('0xa9059cbb')).toBe(true)
  expect(decodeFunctionData({ abi, data })).toEqual({
    functionName: 'transfer',
    args: ['TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe', 1000000n],
  })
})

test('a no-argument function decodes to undefined args', () => {
  const data = encodeFunctionData({ abi, functionName: 'name' })
  expect(decodeFunctionData({ abi, data })).toEqual({
    functionName: 'name',
    args: undefined,
  })
})

test('throws when the selector matches no function on the ABI', () => {
  expect(() => decodeFunctionData({ abi, data: '0xdeadbeef' })).toThrowError(
    AbiFunctionSignatureNotFoundError,
  )
})
