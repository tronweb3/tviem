import type { Abi } from 'abitype'
import { expect, test } from 'vitest'

import {
  AbiDecodingZeroDataError,
  AbiErrorInputsNotFoundError,
  AbiErrorNotFoundError,
  AbiErrorSignatureNotFoundError,
  AbiItemAmbiguityError,
} from '../../../src/errors/abi.js'
import { concatHex } from '../../../src/utils/data/concat.js'
import { decodeErrorResult } from '../../../src/utils/abi/decodeErrorResult.js'
import { encodeAbiParameters } from '../../../src/utils/abi/encodeAbiParameters.js'
import { encodeErrorResult } from '../../../src/utils/abi/encodeErrorResult.js'

const abi = [
  {
    type: 'error',
    name: 'InsufficientBalance',
    inputs: [
      { name: 'available', type: 'uint256' },
      { name: 'required', type: 'uint256' },
    ],
  },
  { type: 'error', name: 'Unauthorized', inputs: [] },
] as const satisfies Abi

test('encodeErrorResult: selector + encoded args round-trips through decode', () => {
  const encoded = encodeErrorResult({
    abi,
    errorName: 'InsufficientBalance',
    args: [1n, 2n],
  })
  const decoded = decodeErrorResult({ abi, data: encoded })
  expect(decoded.errorName).toBe('InsufficientBalance')
  expect(decoded.args).toEqual([1n, 2n])
})

test('encodeErrorResult: a no-input error is just its 4-byte selector', () => {
  const encoded = encodeErrorResult({ abi, errorName: 'Unauthorized' })
  expect(encoded).toHaveLength(10) // '0x' + 4 bytes
  expect(decodeErrorResult({ abi, data: encoded }).errorName).toBe(
    'Unauthorized',
  )
})

test('encodeErrorResult: a single-error ABI resolves without errorName', () => {
  const single = [abi[1]] as const satisfies Abi
  expect(encodeErrorResult({ abi: single })).toBe(
    encodeErrorResult({ abi: single, errorName: 'Unauthorized' }),
  )
})

test('encodeErrorResult: throws when the error is not on the ABI', () => {
  expect(() =>
    encodeErrorResult({ abi: abi as Abi, errorName: 'DoesNotExist' }),
  ).toThrowError(AbiErrorNotFoundError)
})

test('encodeErrorResult: throws when args are given but the error has no inputs field', () => {
  const noInputs = [{ type: 'error', name: 'NoInputs' }] as unknown as Abi
  expect(() =>
    encodeErrorResult({ abi: noInputs, errorName: 'NoInputs', args: [1n] }),
  ).toThrowError(AbiErrorInputsNotFoundError)
})

test('decodeErrorResult: recognises the built-in Error(string) revert', () => {
  const data = concatHex([
    '0x08c379a0',
    encodeAbiParameters([{ type: 'string' }], ['reverted']),
  ])
  const decoded = decodeErrorResult({ data })
  expect(decoded.errorName).toBe('Error')
  expect(decoded.args).toEqual(['reverted'])
})

test('decodeErrorResult: recognises the built-in Panic(uint256) revert', () => {
  const data = concatHex([
    '0x4e487b71',
    encodeAbiParameters([{ type: 'uint256' }], [17n]),
  ])
  const decoded = decodeErrorResult({ data })
  expect(decoded.errorName).toBe('Panic')
  expect(decoded.args).toEqual([17n])
})

test('decodeErrorResult: throws on zero data', () => {
  expect(() => decodeErrorResult({ data: '0x' })).toThrowError(
    AbiDecodingZeroDataError,
  )
})

test('decodeErrorResult: throws when the selector matches no error', () => {
  expect(() => decodeErrorResult({ abi, data: '0xdeadbeef' })).toThrowError(
    AbiErrorSignatureNotFoundError,
  )
})

// Overload resolution (via getAbiItem): among same-name overloads that all
// structurally accept `args`, the LAST match wins (reference semantics).
test('encodeErrorResult: the last structural overload wins', () => {
  const overloaded = [
    { type: 'error', name: 'E', inputs: [{ type: 'uint256' }] },
    { type: 'error', name: 'E', inputs: [{ type: 'int256' }] },
  ] as const satisfies Abi
  expect(
    encodeErrorResult({ abi: overloaded, errorName: 'E', args: [1n] }),
  ).toBe(
    encodeErrorResult({
      abi: [overloaded[1]] as const satisfies Abi,
      errorName: 'E',
      args: [1n],
    }),
  )
})

// A genuine address/string ambiguity between two LATER overloads must be
// detected (regression: previously only the first match was ever compared).
test('encodeErrorResult: address/string ambiguity among later overloads throws', () => {
  const ambiguous = [
    { type: 'error', name: 'E', inputs: [{ type: 'bytes32' }] },
    { type: 'error', name: 'E', inputs: [{ type: 'address' }] },
    { type: 'error', name: 'E', inputs: [{ type: 'string' }] },
  ] as const satisfies Abi
  expect(() =>
    encodeErrorResult({
      abi: ambiguous,
      errorName: 'E',
      args: ['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'],
    }),
  ).toThrowError(AbiItemAmbiguityError)
})
