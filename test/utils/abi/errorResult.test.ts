import type { Abi } from 'abitype'
import { expect, test } from 'vitest'

import {
  AbiDecodingZeroDataError,
  AbiEncodingLengthMismatchError,
  AbiErrorInputsNotFoundError,
  AbiErrorNotFoundError,
  AbiErrorSignatureNotFoundError,
  AbiItemAmbiguityError,
} from '../../../src/errors/abi.js'
import { decodeErrorResult } from '../../../src/utils/abi/decodeErrorResult.js'
import { encodeAbiParameters } from '../../../src/utils/abi/encodeAbiParameters.js'
import { encodeErrorResult } from '../../../src/utils/abi/encodeErrorResult.js'
import { concatHex } from '../../../src/utils/data/concat.js'

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

// Encode-side mirror of decode's built-in handling: the Solidity `Error` /
// `Panic` reverts encode without any ABI, and still resolve when an ABI is
// given that doesn't declare them.
test('encodeErrorResult: encodes the built-in Error(string) without an ABI', () => {
  const encoded = encodeErrorResult({ errorName: 'Error', args: ['reverted'] })
  expect(encoded).toBe(
    concatHex([
      '0x08c379a0',
      encodeAbiParameters([{ type: 'string' }], ['reverted']),
    ]),
  )
  expect(decodeErrorResult({ data: encoded }).args).toEqual(['reverted'])
})

test('encodeErrorResult: encodes the built-in Panic(uint256) without an ABI', () => {
  const encoded = encodeErrorResult({ errorName: 'Panic', args: [17n] })
  expect(encoded).toBe(
    concatHex([
      '0x4e487b71',
      encodeAbiParameters([{ type: 'uint256' }], [17n]),
    ]),
  )
  expect(decodeErrorResult({ data: encoded }).args).toEqual([17n])
})

test('encodeErrorResult: built-ins resolve alongside an ABI that lacks them', () => {
  expect(
    encodeErrorResult({ abi, errorName: 'Error', args: ['reverted'] }),
  ).toBe(encodeErrorResult({ errorName: 'Error', args: ['reverted'] }))
})

// A user-declared error named `Error` wins over the built-in — the same
// precedence decodeErrorResult gives the user's ABI on selector conflicts.
test('encodeErrorResult: a user-declared Error shadows the built-in', () => {
  const shadowing = [
    { type: 'error', name: 'Error', inputs: [{ type: 'uint256' }] },
  ] as const satisfies Abi
  const encoded = encodeErrorResult({
    abi: shadowing,
    errorName: 'Error',
    args: [1n],
  })
  expect(encoded.slice(0, 10)).not.toBe('0x08c379a0')
  expect(decodeErrorResult({ abi: shadowing, data: encoded }).args).toEqual([
    1n,
  ])
})

// With no ABI there are two built-in candidates, so omitting errorName is
// ambiguous and must throw rather than silently pick one.
test('encodeErrorResult: no ABI and no errorName throws', () => {
  expect(() => encodeErrorResult({ args: ['x'] } as never)).toThrowError(
    AbiErrorNotFoundError,
  )
})

test('encodeErrorResult: unknown errorName without an ABI throws', () => {
  expect(() =>
    encodeErrorResult({ errorName: 'DoesNotExist' } as never),
  ).toThrowError(AbiErrorNotFoundError)
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
// structurally accept `args` WITHOUT being ambiguous, the LAST match wins
// (reference semantics). A non-address hex string matches both string and
// bytes, and no ambiguity rule pairs them.
test('encodeErrorResult: the last structural overload wins', () => {
  const overloaded = [
    { type: 'error', name: 'E', inputs: [{ type: 'string' }] },
    { type: 'error', name: 'E', inputs: [{ type: 'bytes' }] },
  ] as const satisfies Abi
  expect(
    encodeErrorResult({ abi: overloaded, errorName: 'E', args: ['0x1234'] }),
  ).toBe(
    encodeErrorResult({
      abi: [overloaded[1]] as const satisfies Abi,
      errorName: 'E',
      args: ['0x1234'],
    }),
  )
})

// Differing integer widths are NOT resolved by last-match-wins: they encode
// the same 32-byte word under different selectors, so the combination throws.
test('encodeErrorResult: an integer-width overload pair throws', () => {
  const overloaded = [
    { type: 'error', name: 'E', inputs: [{ type: 'uint256' }] },
    { type: 'error', name: 'E', inputs: [{ type: 'int256' }] },
  ] as const satisfies Abi
  expect(() =>
    encodeErrorResult({ abi: overloaded, errorName: 'E', args: [1n] }),
  ).toThrowError(AbiItemAmbiguityError)
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
      args: ['TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe'],
    }),
  ).toThrowError(AbiItemAmbiguityError)
})

// An error that DECLARES inputs must not encode without them: the bare
// selector would be a payload the same ABI cannot decode. Zero-input errors
// keep encoding to the selector alone. Mirrors encodeDeployData's constructor
// handling.
test('encodeErrorResult rejects missing required args', () => {
  const abi = [
    {
      type: 'error',
      name: 'InsufficientBalance',
      inputs: [{ name: 'available', type: 'uint256' }],
    },
  ] as const

  expect(() =>
    encodeErrorResult({ abi, errorName: 'InsufficientBalance' } as never),
  ).toThrow(AbiEncodingLengthMismatchError)
  expect(() =>
    encodeErrorResult({
      abi,
      errorName: 'InsufficientBalance',
      args: [] as never,
    } as never),
  ).toThrow(AbiEncodingLengthMismatchError)
  // With the arg present the payload round-trips as before.
  expect(
    encodeErrorResult({
      abi,
      errorName: 'InsufficientBalance',
      args: [1n],
    }),
  ).toMatch(/^0x[0-9a-f]{8}0{63}1$/)
})
