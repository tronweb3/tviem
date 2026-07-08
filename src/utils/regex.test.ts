// New test file for @tronweb3/omni (no upstream utils/regex.test.ts): match/non-match coverage for the vendored ABI type regexes.
import { expect, test } from 'vitest'

import { arrayRegex, bytesRegex, integerRegex } from './regex.js'

test('arrayRegex', () => {
  expect(arrayRegex.test('uint256[]')).toBe(true)
  expect(arrayRegex.test('uint256[3]')).toBe(true)
  expect(arrayRegex.test('address[][2]')).toBe(true)
  expect(arrayRegex.test('(uint256,address)[]')).toBe(true)
  expect(arrayRegex.test('uint256')).toBe(false)
  expect(arrayRegex.test('uint256[')).toBe(false)

  const match = 'uint256[3]'.match(arrayRegex)
  expect(match?.[1]).toBe('uint256')
  expect(match?.[2]).toBe('3')

  const dynamicMatch = 'uint256[]'.match(arrayRegex)
  expect(dynamicMatch?.[1]).toBe('uint256')
  expect(dynamicMatch?.[2]).toBe('')
})

test('bytesRegex', () => {
  expect(bytesRegex.test('bytes')).toBe(true)
  expect(bytesRegex.test('bytes1')).toBe(true)
  expect(bytesRegex.test('bytes20')).toBe(true)
  expect(bytesRegex.test('bytes32')).toBe(true)
  expect(bytesRegex.test('bytes0')).toBe(false)
  expect(bytesRegex.test('bytes33')).toBe(false)
  expect(bytesRegex.test('bytes256')).toBe(false)

  expect('bytes32'.match(bytesRegex)?.[1]).toBe('32')
})

test('integerRegex', () => {
  expect(integerRegex.test('uint')).toBe(true)
  expect(integerRegex.test('int')).toBe(true)
  expect(integerRegex.test('uint8')).toBe(true)
  expect(integerRegex.test('int8')).toBe(true)
  expect(integerRegex.test('uint256')).toBe(true)
  expect(integerRegex.test('int256')).toBe(true)
  expect(integerRegex.test('uint7')).toBe(false)
  expect(integerRegex.test('uint264')).toBe(false)
  expect(integerRegex.test('int512')).toBe(false)
  expect(integerRegex.test('float')).toBe(false)

  const match = 'uint256'.match(integerRegex)
  expect(match?.[1]).toBe('uint')
  expect(match?.[2]).toBe('256')
})
