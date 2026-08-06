// Type-surface tests for `encodeAbiParameters` (Track C).
// The `params` literal drives the `values` parameter type via
// `TronAbiParametersToPrimitiveTypes<params, 'inputs'>` — address is wide-in
// (`AddressInput`), every integer width accepts `bigint | number`, `bool`
// wants `boolean`, `bytes*` want `Hex`, and `string` wants `string`.
import { expectTypeOf, test } from 'vitest'

import type { AddressInput } from '../../../src/types/address.js'
import type { Hex } from '../../../src/types/misc.js'
import {
  encodeAbiParameters,
  type TronAbiParametersToPrimitiveTypes,
  type TronAbiParameterToPrimitiveType,
} from '../../../src/utils/abi/encodeAbiParameters.js'

test('return type is always Hex', () => {
  expectTypeOf(
    encodeAbiParameters([{ type: 'uint256' }], [1n]),
  ).toEqualTypeOf<Hex>()
})

test('the params literal drives the values tuple type', () => {
  // A literal `params` list infers a positional `values` tuple. `const` on the
  // type parameter means no `as const` is needed at the call site.
  // `const params` infers a readonly tuple, so the homomorphic mapped type
  // yields a readonly `values` tuple.
  expectTypeOf<
    TronAbiParametersToPrimitiveTypes<
      readonly [{ type: 'address' }, { type: 'uint256' }],
      'inputs'
    >
  >().toEqualTypeOf<readonly [AddressInput, bigint | number]>()

  // per-type mapping (inputs kind)
  expectTypeOf<
    TronAbiParameterToPrimitiveType<{ type: 'address' }, 'inputs'>
  >().toEqualTypeOf<AddressInput>()
  expectTypeOf<
    TronAbiParameterToPrimitiveType<{ type: 'uint256' }, 'inputs'>
  >().toEqualTypeOf<bigint | number>()
  expectTypeOf<
    TronAbiParameterToPrimitiveType<{ type: 'int64' }, 'inputs'>
  >().toEqualTypeOf<bigint | number>()
  // `trcToken` behaves exactly like `uint256`
  expectTypeOf<
    TronAbiParameterToPrimitiveType<{ type: 'trcToken' }, 'inputs'>
  >().toEqualTypeOf<bigint | number>()
  expectTypeOf<
    TronAbiParameterToPrimitiveType<{ type: 'bool' }, 'inputs'>
  >().toEqualTypeOf<boolean>()
  expectTypeOf<
    TronAbiParameterToPrimitiveType<{ type: 'string' }, 'inputs'>
  >().toEqualTypeOf<string>()
  expectTypeOf<
    TronAbiParameterToPrimitiveType<{ type: 'bytes' }, 'inputs'>
  >().toEqualTypeOf<Hex>()
  expectTypeOf<
    TronAbiParameterToPrimitiveType<{ type: 'bytes32' }, 'inputs'>
  >().toEqualTypeOf<Hex>()
  // dynamic array → readonly list of the element type
  expectTypeOf<
    TronAbiParameterToPrimitiveType<{ type: 'uint256[]' }, 'inputs'>
  >().toEqualTypeOf<readonly (bigint | number)[]>()
})

test('values accepts the correct primitive forms', () => {
  // address is wide-in: all three TRON forms are accepted as string literals
  encodeAbiParameters(
    [{ type: 'address' }],
    ['TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe'],
  )
  encodeAbiParameters(
    [{ type: 'address' }],
    ['412b5ad5c4795c026514f8317c7a215e218dccd6cf'],
  )
  encodeAbiParameters(
    [{ type: 'address' }],
    ['0x2b5ad5c4795c026514f8317c7a215e218dccd6cf'],
  )
  // integers accept both bigint and number
  encodeAbiParameters([{ type: 'uint256' }], [1000000n])
  encodeAbiParameters([{ type: 'uint8' }], [255])
  // bool / string / bytes
  encodeAbiParameters([{ type: 'bool' }], [true])
  encodeAbiParameters([{ type: 'string' }], ['hello'])
  encodeAbiParameters([{ type: 'bytes' }], ['0xdeadbeef'])
  encodeAbiParameters([{ type: 'uint256[]' }], [[1n, 2n, 3n]])
})

test('values rejects mismatched primitive forms', () => {
  // @ts-expect-error string is not a valid uint value
  encodeAbiParameters([{ type: 'uint256' }], ['nope'])

  // @ts-expect-error boolean is not a valid address value
  encodeAbiParameters([{ type: 'address' }], [true])

  // @ts-expect-error a bare string is not a branded address form
  encodeAbiParameters([{ type: 'address' }], ['not-an-address' as string])

  // @ts-expect-error number literal is not a boolean
  encodeAbiParameters([{ type: 'bool' }], [1])

  // @ts-expect-error bytes wants Hex, not raw string
  encodeAbiParameters([{ type: 'bytes' }], ['deadbeef'])

  // @ts-expect-error arity mismatch (too many values)
  encodeAbiParameters([{ type: 'uint256' }], [1n, 2n])
})
