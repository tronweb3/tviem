import { describe, expect, test } from 'vitest'
import {
  AbiEncodingBytesSizeMismatchError,
  AbiEncodingLengthMismatchError,
} from '../../../src/errors/abi.js'
import { InvalidHexValueError } from '../../../src/errors/encoding.js'
import { decodeAbiParameters } from '../../../src/utils/abi/decodeAbiParameters.js'
import { encodeAbiParameters } from '../../../src/utils/abi/encodeAbiParameters.js'

function caught(fn: () => unknown): Error | undefined {
  try {
    fn()
    return undefined
  } catch (error) {
    return error as Error
  }
}

// A hex string with an odd nibble count is not a byte string. `size()` rounds
// it up and `padHex` right-pads it, so the encoder would invent the missing
// nibble: the emitted value is one the caller never supplied, and the `bytesN`
// width check is bypassed by the same rounding.
test('encodeBytes: an odd-length `bytes` value throws instead of gaining a nibble', () => {
  const error = caught(() =>
    encodeAbiParameters([{ type: 'bytes' }], ['0x123']),
  )
  expect(error).toBeInstanceOf(InvalidHexValueError)
  // Before the guard this encoded length=2 with payload 0x1230, which
  // round-tripped to '0x1230' — a value that was never passed in.
})

test('encodeBytes: an odd-length `bytesN` value throws instead of passing the width check', () => {
  const error = caught(() =>
    encodeAbiParameters([{ type: 'bytes2' }], ['0x123']),
  )
  expect(error).toBeInstanceOf(InvalidHexValueError)
})

test('encodeBytes: a genuinely wrong `bytesN` width still reports the width error', () => {
  const error = caught(() =>
    encodeAbiParameters([{ type: 'bytes2' }], ['0x123456']),
  )
  expect(error).toBeInstanceOf(AbiEncodingBytesSizeMismatchError)
})

test('encodeBytes: well-formed values still encode and round-trip', () => {
  const dynamic = encodeAbiParameters([{ type: 'bytes' }], ['0x1234'])
  expect(decodeAbiParameters([{ type: 'bytes' }], dynamic)).toStrictEqual([
    '0x1234',
  ])
  const empty = encodeAbiParameters([{ type: 'bytes' }], ['0x'])
  expect(decodeAbiParameters([{ type: 'bytes' }], empty)).toStrictEqual(['0x'])
  const fixed = encodeAbiParameters([{ type: 'bytes2' }], ['0x1234'])
  expect(decodeAbiParameters([{ type: 'bytes2' }], fixed)).toStrictEqual([
    '0x1234',
  ])
})

// The guard lives inside `encodeBytes`, which `encodeArray`/`encodeTuple`
// recurse through — so it must fire for a bad value at any depth, not just for
// a top-level scalar. Without these, hoisting the guard to a top-level loop
// over `values` would pass the whole suite while leaving every nested shape
// unprotected.
test('encodeBytes: the guard applies to a `bytes` element inside a dynamic array', () => {
  const error = caught(() =>
    encodeAbiParameters([{ type: 'bytes[]' }], [['0x123']]),
  )
  expect(error).toBeInstanceOf(InvalidHexValueError)
  // Before the guard this emitted a tail of length=2 with payload 0x1230.
  expect(() =>
    encodeAbiParameters([{ type: 'bytes[]' }], [['0x1234']]),
  ).not.toThrow()
})

test('encodeBytes: the guard applies to a `bytesN` component inside a tuple', () => {
  const error = caught(() =>
    encodeAbiParameters(
      [{ type: 'tuple', components: [{ type: 'bytes2' }] }],
      [['0x123']],
    ),
  )
  expect(error).toBeInstanceOf(InvalidHexValueError)
})

test('encodeBytes: the guard applies to a `bytesN` element inside a fixed-size array', () => {
  const error = caught(() =>
    encodeAbiParameters([{ type: 'bytes2[2]' }], [['0x123', '0x1234']]),
  )
  expect(error).toBeInstanceOf(InvalidHexValueError)
})

// `encodeTuple` reads one value per declared component, so anything extra is
// never looked at. Every sibling arity check in this file is strict — the top
// level throws AbiEncodingLengthMismatchError and fixed-size arrays throw
// AbiEncodingArrayLengthMismatchError — so a struct that gained or lost a
// field between ABI versions must not encode to a well-formed wrong payload.
describe('tuple arity is strict', () => {
  const one = [
    { type: 'tuple', components: [{ name: 'a', type: 'uint256' }] },
  ] as const
  const two = [
    {
      type: 'tuple',
      components: [
        { name: 'a', type: 'uint256' },
        { name: 'b', type: 'uint256' },
      ],
    },
  ] as const

  test('extra positional values throw instead of being dropped', () => {
    const error = caught(() =>
      encodeAbiParameters(one as never, [[1n, 2n, 3n]] as never),
    )
    expect(error).toBeInstanceOf(AbiEncodingLengthMismatchError)
    expect(error?.message).toContain('Expected length (params): 1')
    expect(error?.message).toContain('Given length (values): 3')
  })

  test('extra named keys throw instead of being dropped', () => {
    const error = caught(() =>
      encodeAbiParameters(one as never, [{ a: 1n, extra: 2n }] as never),
    )
    expect(error).toBeInstanceOf(AbiEncodingLengthMismatchError)
  })

  test('too few values report the arity, not an undefined-value type error', () => {
    const short = caught(() =>
      encodeAbiParameters(two as never, [[1n]] as never),
    )
    expect(short).toBeInstanceOf(AbiEncodingLengthMismatchError)
    const missing = caught(() =>
      encodeAbiParameters(one as never, [{}] as never),
    )
    expect(missing).toBeInstanceOf(AbiEncodingLengthMismatchError)
  })

  test('an exact tuple still encodes the same, positionally or by name', () => {
    const expected = `0x${'0'.repeat(63)}1`
    expect(encodeAbiParameters(one as never, [[1n]] as never)).toBe(expected)
    expect(encodeAbiParameters(one as never, [{ a: 1n }] as never)).toBe(
      expected,
    )
  })

  test('the check reaches a tuple nested inside another tuple', () => {
    const nested = [
      {
        type: 'tuple',
        components: [
          {
            name: 'inner',
            type: 'tuple',
            components: [{ name: 'a', type: 'uint256' }],
          },
        ],
      },
    ] as const
    expect(
      caught(() => encodeAbiParameters(nested as never, [[[1n, 2n]]] as never)),
    ).toBeInstanceOf(AbiEncodingLengthMismatchError)
    expect(() =>
      encodeAbiParameters(nested as never, [[[1n]]] as never),
    ).not.toThrow()
  })
})
