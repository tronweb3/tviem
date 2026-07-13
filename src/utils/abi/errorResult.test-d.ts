// Type-surface tests for the contract-error codecs (Track C / increment ①):
// `encodeErrorResult` (errorName inference → Hex) and `decodeErrorResult`
// (errorName union always includes the built-in `Error` / `Panic`).
import { expectTypeOf, test } from 'vitest'

import type { Hex } from '../../types/misc.js'
import { decodeErrorResult } from './decodeErrorResult.js'
import { encodeErrorResult } from './encodeErrorResult.js'

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

test('decodeErrorResult: errorName union includes the Solidity built-ins', () => {
  const result = decodeErrorResult({ abi, data: '0x00000000' })
  expectTypeOf(result.errorName).toEqualTypeOf<
    'InsufficientBalance' | 'Error' | 'Panic'
  >()
})
