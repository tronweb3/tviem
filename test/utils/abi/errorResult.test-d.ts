// Type-surface tests for the contract-error codecs (Track C / increment ①):
// `encodeErrorResult` (errorName inference → Hex) and `decodeErrorResult`
// (errorName union always includes the built-in `Error` / `Panic`).
import { expectTypeOf, test } from 'vitest'

import type { Hex } from '../../../src/types/misc.js'
import { decodeErrorResult } from '../../../src/utils/abi/decodeErrorResult.js'
import { encodeErrorResult } from '../../../src/utils/abi/encodeErrorResult.js'

const abi = [
  {
    type: 'error',
    name: 'InsufficientBalance',
    inputs: [{ name: 'available', type: 'uint256' }],
  },
] as const

test('encodeErrorResult: returns a revert payload (Hex)', () => {
  expectTypeOf(
    encodeErrorResult({ abi, errorName: 'InsufficientBalance', args: [1n] }),
  ).toEqualTypeOf<Hex>()

  // @ts-expect-error `Nope` is not an error on this ABI
  encodeErrorResult({ abi, errorName: 'Nope', args: [1n] })
})

test('encodeErrorResult: built-ins encode without an abi', () => {
  expectTypeOf(
    encodeErrorResult({ errorName: 'Error', args: ['oops'] }),
  ).toEqualTypeOf<Hex>()
  expectTypeOf(
    encodeErrorResult({ errorName: 'Panic', args: [17n] }),
  ).toEqualTypeOf<Hex>()

  // @ts-expect-error `Nope` is not a built-in error
  encodeErrorResult({ errorName: 'Nope' })

  // Built-ins stay valid alongside an ABI that doesn't declare them.
  expectTypeOf(
    encodeErrorResult({ abi, errorName: 'Error', args: ['oops'] }),
  ).toEqualTypeOf<Hex>()
})

test('decodeErrorResult: errorName union includes the Solidity built-ins', () => {
  const result = decodeErrorResult({ abi, data: '0x00000000' })
  expectTypeOf(result.errorName).toEqualTypeOf<
    'InsufficientBalance' | 'Error' | 'Panic'
  >()
})
