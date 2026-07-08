import type { Abi } from 'abitype'
import { expect, test } from 'vitest'

import {
  type FunctionFixture,
  loadFunctionFixtures,
  reviveValues,
} from '../../../test/fixtures/abi/loader.js'
import { slice } from '../data/slice.js'
import { encodeFunctionData } from './encodeFunctionData.js'
import { prepareEncodeFunctionData } from './prepareEncodeFunctionData.js'

/** Picks the overload whose input count matches the fixture args. */
function fnFor(fixture: FunctionFixture): FunctionFixture['abi'][number] {
  return fixture.abi.find((item) => item.inputs.length === fixture.args.length)!
}

test('every gold function fixture re-encodes byte-for-byte', () => {
  const fixtures = loadFunctionFixtures()
  expect(fixtures.length).toBeGreaterThanOrEqual(9)
  for (const fixture of fixtures) {
    const item = fnFor(fixture)
    const args = reviveValues(item.inputs, fixture.args)
    const calldata = encodeFunctionData({
      abi: fixture.abi as unknown as Abi,
      functionName: fixture.functionName,
      args,
    })
    expect(calldata, fixture.name).toBe(fixture.calldata)
  }
})

test('§2.4 TRC20 transfer calldata is exact', () => {
  const fixture = loadFunctionFixtures().find(
    (f) => f.name === 'trc20-transfer',
  )!
  const calldata = encodeFunctionData({
    abi: fixture.abi as unknown as Abi,
    functionName: 'transfer',
    args: ['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 1000000n],
  })
  expect(calldata).toBe(
    '0xa9059cbb000000000000000000000000a614f803b6fd780986a42c78ec9c7f77e6ded13c00000000000000000000000000000000000000000000000000000000000f4240',
  )
})

test('§2.4 TRC20 balanceOf selector is 0x70a08231', () => {
  const fixture = loadFunctionFixtures().find(
    (f) => f.name === 'trc20-balanceOf',
  )!
  const { functionName } = prepareEncodeFunctionData({
    abi: fixture.abi as unknown as Abi,
    functionName: 'balanceOf',
  })
  expect(functionName).toBe('0x70a08231')
  const calldata = encodeFunctionData({
    abi: fixture.abi as unknown as Abi,
    functionName: 'balanceOf',
    args: ['TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'],
  })
  expect(slice(calldata, 0, 4)).toBe('0x70a08231')
  expect(calldata).toBe(fixture.calldata)
})

test('trcToken parameter keeps its selector (transferToken -> 0x4dd52d8b)', () => {
  const fixture = loadFunctionFixtures().find(
    (f) => f.name === 'trcToken-transferToken',
  )!
  const { functionName } = prepareEncodeFunctionData({
    abi: fixture.abi as unknown as Abi,
    functionName: 'transferToken',
  })
  expect(functionName).toBe('0x4dd52d8b')
  const calldata = encodeFunctionData({
    abi: fixture.abi as unknown as Abi,
    functionName: 'transferToken',
    args: ['TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC', 1002000n, 9n],
  })
  expect(calldata).toBe(fixture.calldata)
})

test('overloads select the right selector by args', () => {
  const three = loadFunctionFixtures().find(
    (f) => f.name === 'overload-safeTransferFrom-3args',
  )!
  const item3 = fnFor(three)
  expect(
    encodeFunctionData({
      abi: three.abi as unknown as Abi,
      functionName: 'safeTransferFrom',
      args: reviveValues(item3.inputs, three.args),
    }),
  ).toBe(three.calldata)
  const four = loadFunctionFixtures().find(
    (f) => f.name === 'overload-safeTransferFrom-4args',
  )!
  const item4 = fnFor(four)
  expect(
    encodeFunctionData({
      abi: four.abi as unknown as Abi,
      functionName: 'safeTransferFrom',
      args: reviveValues(item4.inputs, four.args),
    }),
  ).toBe(four.calldata)
})

test('a prepared result re-encodes without re-resolving', () => {
  const fixture = loadFunctionFixtures().find(
    (f) => f.name === 'trc20-transfer',
  )!
  const prepared = prepareEncodeFunctionData({
    abi: fixture.abi as unknown as Abi,
    functionName: 'transfer',
  })
  const calldata = encodeFunctionData({
    ...prepared,
    args: ['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 1000000n],
  })
  expect(calldata).toBe(fixture.calldata)
})
