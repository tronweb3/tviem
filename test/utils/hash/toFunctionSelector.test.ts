import { expect, test } from 'vitest'

import { toFunctionSelector } from '../../../src/utils/hash/toFunctionSelector.js'

test('creates function signature', () => {
  expect(toFunctionSelector('_compound(uint256,uint256,uint256)')).toEqual(
    '0xf4fbb312',
  )
  expect(
    toFunctionSelector('function _compound(uint256 a, uint256 b, uint256 c)'),
  ).toEqual('0xf4fbb312')
  expect(toFunctionSelector('function ownerOf(uint256 tokenId)')).toEqual(
    '0x6352211e',
  )
  expect(toFunctionSelector('ownerOf(uint256)')).toEqual('0x6352211e')
  expect(toFunctionSelector('processInvestment(address,uint256,bool)')).toEqual(
    '0xcf4b8f61',
  )
  expect(toFunctionSelector('processAccount(uint256 , address )')).toEqual(
    '0x73933128',
  )
  expect(toFunctionSelector('claimed()')).toEqual('0xe834a834')
  expect(toFunctionSelector('function claimed()')).toEqual('0xe834a834')
})

test('creates function signature from `AbiFunction`', () => {
  expect(
    toFunctionSelector({
      name: '_compound',
      type: 'function',
      inputs: [
        { name: 'a', type: 'uint256' },
        { name: 'b', type: 'uint256' },
        { name: 'c', type: 'uint256' },
      ],
      outputs: [],
      stateMutability: 'nonpayable',
    }),
  ).toEqual('0xf4fbb312')

  expect(
    toFunctionSelector({
      name: '_compound',
      type: 'function',
      inputs: [
        { name: '', type: 'uint256' },
        { name: '', type: 'uint256' },
        { name: '', type: 'uint256' },
      ],
      outputs: [],
      stateMutability: 'nonpayable',
    }),
  ).toEqual('0xf4fbb312')

  expect(
    toFunctionSelector({
      name: 'ownerOf',
      type: 'function',
      inputs: [{ name: 'tokenId', type: 'uint256' }],
      outputs: [],
      stateMutability: 'view',
    }),
  ).toEqual('0x6352211e')

  expect(
    toFunctionSelector({
      name: 'ownerOf',
      type: 'function',
      inputs: [{ name: '', type: 'uint256' }],
      outputs: [],
      stateMutability: 'view',
    }),
  ).toEqual('0x6352211e')

  expect(
    toFunctionSelector({
      name: 'processInvestment',
      type: 'function',
      inputs: [
        { name: '', type: 'address' },
        { name: '', type: 'uint256' },
        { name: '', type: 'bool' },
      ],
      outputs: [],
      stateMutability: 'nonpayable',
    }),
  ).toEqual('0xcf4b8f61')

  expect(
    toFunctionSelector({
      name: 'processAccount',
      type: 'function',
      inputs: [
        { name: '', type: 'uint256' },
        { name: '', type: 'address' },
      ],
      outputs: [],
      stateMutability: 'nonpayable',
    }),
  ).toEqual('0x73933128')

  expect(
    toFunctionSelector({
      name: 'claimed',
      type: 'function',
      inputs: [],
      outputs: [],
      stateMutability: 'view',
    }),
  ).toEqual('0xe834a834')

  expect(
    toFunctionSelector({
      inputs: [
        {
          components: [
            {
              name: 'position',
              type: 'uint64',
            },
            {
              name: 'owner',
              type: 'address',
            },
            {
              name: 'color',
              type: 'uint8',
            },
            {
              name: 'life',
              type: 'uint8',
            },
          ],
          name: 'cells',
          type: 'tuple[]',
        },
      ],
      name: 'forceSimpleCells',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    }),
  ).toEqual('0xd703f50a')
})

test('@tronweb3/omni: TRC-20 selectors', () => {
  expect(toFunctionSelector('function transfer(address,uint256)')).toBe(
    '0xa9059cbb',
  )
  expect(toFunctionSelector('transfer(address,uint256)')).toBe('0xa9059cbb')
  expect(toFunctionSelector('balanceOf(address)')).toBe('0x70a08231')
  expect(toFunctionSelector('approve(address,uint256)')).toBe('0x095ea7b3')
  expect(toFunctionSelector('transferFrom(address,address,uint256)')).toBe(
    '0x23b872dd',
  )
})

test('bare Solidity type aliases are NOT canonicalized', () => {
  // pins viem-aligned behavior: bare 'uint' is hashed as-is (not expanded to
  // 'uint256'), so callers must pass canonical types to get canonical selectors.
  expect(toFunctionSelector('foo(uint)')).not.toBe(
    toFunctionSelector('foo(uint256)'),
  )
  expect(toFunctionSelector('foo(uint256)')).toBe('0x2fbebd38')
})
