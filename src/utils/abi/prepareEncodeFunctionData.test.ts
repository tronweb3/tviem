import type { Abi } from 'abitype'
import { expect, test } from 'vitest'
import { loadFunctionFixtures } from '../../../test/fixtures/abi/loader.js'
import { AbiFunctionNotFoundError } from '../../errors/abi.js'
import { prepareEncodeFunctionData } from './prepareEncodeFunctionData.js'

test('derives the selector and narrows the abi to one item', () => {
  const fixture = loadFunctionFixtures().find(
    (f) => f.name === 'trc20-transfer',
  )!
  const { abi, functionName } = prepareEncodeFunctionData({
    abi: fixture.abi as unknown as Abi,
    functionName: 'transfer',
  })
  expect(functionName).toBe('0xa9059cbb')
  expect(abi.length).toBe(1)
  expect((abi[0] as { name: string }).name).toBe('transfer')
})

test('works for a no-argument function', () => {
  const fixture = loadFunctionFixtures().find(
    (f) => f.name === 'no-args-totalSupply',
  )!
  const { functionName } = prepareEncodeFunctionData({
    abi: fixture.abi as unknown as Abi,
    functionName: 'totalSupply',
  })
  expect(functionName).toBe('0x18160ddd')
})

test('defaults to the sole item when functionName is omitted', () => {
  const fixture = loadFunctionFixtures().find(
    (f) => f.name === 'trc20-balanceOf',
  )!
  const { functionName } = prepareEncodeFunctionData({
    abi: fixture.abi as unknown as Abi,
  })
  expect(functionName).toBe('0x70a08231')
})

test('throws when the function is absent', () => {
  const fixture = loadFunctionFixtures().find(
    (f) => f.name === 'trc20-transfer',
  )!
  expect(() =>
    prepareEncodeFunctionData({
      abi: fixture.abi as unknown as Abi,
      functionName: 'nope' as never,
    }),
  ).toThrowError(AbiFunctionNotFoundError)
})

test('throws when the resolved item is not a function', () => {
  const eventOnly = [
    {
      type: 'event',
      name: 'Transfer',
      inputs: [{ name: 'from', type: 'address', indexed: true }],
      anonymous: false,
    },
  ] as const satisfies Abi
  expect(() => prepareEncodeFunctionData({ abi: eventOnly })).toThrowError(
    AbiFunctionNotFoundError,
  )
})
