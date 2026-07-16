import type { Abi } from 'abitype'
import { expect, test } from 'vitest'
import {
  type FixtureValue,
  loadFunctionFixtures,
  reviveValue,
  reviveValues,
} from '../../fixtures/abi/loader.js'
import { AbiFunctionOutputsNotFoundError } from '../../../src/errors/abi.js'
import { decodeFunctionResult } from '../../../src/utils/abi/decodeFunctionResult.js'

test('every gold function fixture with returnData decodes deep-equal', () => {
  for (const fixture of loadFunctionFixtures()) {
    if (!fixture.result) continue
    const outputs = fixture.abi[0]!.outputs
    const result = decodeFunctionResult({
      abi: fixture.abi as unknown as Abi,
      functionName: fixture.functionName,
      data: fixture.result.returnData,
    })

    const { decoded } = fixture.result
    if (decoded === null || outputs.length === 0) {
      expect(result, fixture.name).toBeUndefined()
    } else if (outputs.length === 1) {
      expect(result, fixture.name).toEqual(reviveValue(outputs[0]!, decoded))
    } else {
      expect(result, fixture.name).toEqual(
        reviveValues(outputs, decoded as FixtureValue[]),
      )
    }
  }
})

test('single uint256 output unwraps to a bigint', () => {
  const fixture = loadFunctionFixtures().find(
    (f) => f.name === 'trc20-balanceOf',
  )!
  const result = decodeFunctionResult({
    abi: fixture.abi as unknown as Abi,
    functionName: 'balanceOf',
    data: fixture.result!.returnData,
  })
  expect(result).toBe(123456789000000000000000000n)
})

test('single address output decodes to Base58Check', () => {
  const fixture = loadFunctionFixtures().find(
    (f) => f.name === 'no-args-owner-returns-address',
  )!
  const result = decodeFunctionResult({
    abi: fixture.abi as unknown as Abi,
    functionName: 'owner',
    data: fixture.result!.returnData,
  })
  expect(result).toBe('TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K')
})

test('multiple outputs return a positional tuple', () => {
  const fixture = loadFunctionFixtures().find(
    (f) => f.name === 'multi-return-getReserves',
  )!
  const result = decodeFunctionResult({
    abi: fixture.abi as unknown as Abi,
    functionName: 'getReserves',
    data: fixture.result!.returnData,
  })
  expect(result).toEqual([1000000n, 2000000n, 1700000000n])
})

test('no outputs decode to undefined', () => {
  const fixture = loadFunctionFixtures().find(
    (f) => f.name === 'no-return-burn',
  )!
  const result = decodeFunctionResult({
    abi: fixture.abi as unknown as Abi,
    functionName: 'burn',
    data: fixture.result!.returnData,
  })
  expect(result).toBeUndefined()
})

test('throws when the ABI item has no outputs field', () => {
  const abi = [
    {
      type: 'function',
      name: 'noOutputs',
      inputs: [],
      stateMutability: 'view',
    },
  ] as unknown as Abi
  expect(() =>
    decodeFunctionResult({ abi, functionName: 'noOutputs', data: '0x' }),
  ).toThrowError(AbiFunctionOutputsNotFoundError)
})
