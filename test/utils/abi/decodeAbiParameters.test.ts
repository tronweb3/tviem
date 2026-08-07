import { describe, expect, test } from 'vitest'
import {
  AbiDecodingDataSizeInvalidError,
  AbiDecodingZeroSizeElementError,
} from '../../../src/errors/abi.js'
import { BaseError } from '../../../src/errors/base.js'
import { InvalidHexValueError } from '../../../src/errors/encoding.js'
import { decodeAbiParameters } from '../../../src/utils/abi/decodeAbiParameters.js'
import { decodeFunctionResult } from '../../../src/utils/abi/decodeFunctionResult.js'

const word = (n: number) => n.toString(16).padStart(64, '0')

/** Head offset -> 0x20, the array length word, then one word of element area. */
const dynamicArray = (length: number) =>
  `0x${word(32)}${word(length)}${word(0)}` as `0x${string}`

function caught(fn: () => unknown): Error | undefined {
  try {
    fn()
    return undefined
  } catch (error) {
    return error as Error
  }
}

// A static element type that occupies zero bytes never advances the cursor, so
// the bounds check that normally terminates a runaway array can never fire. The
// length of a dynamic array comes from the (untrusted) data, so without a
// forward-progress guard a 96-byte payload buys up to 2**53-1 iterations.
describe('zero-size array elements', () => {
  test('rejects a data-supplied length for a tuple with no components', () => {
    const error = caught(() =>
      decodeAbiParameters(
        [{ type: 'tuple[]', components: [] }],
        dynamicArray(3_000_000),
      ),
    )
    expect(error).toBeInstanceOf(AbiDecodingZeroSizeElementError)
    expect(error).toBeInstanceOf(BaseError)
    expect(error?.message).toContain('"tuple" consumes no bytes')
  })

  test('rejects a data-supplied length for a zero-length inner array', () => {
    const error = caught(() =>
      decodeAbiParameters([{ type: 'uint256[0][]' }], dynamicArray(3_000_000)),
    )
    expect(error).toBeInstanceOf(AbiDecodingZeroSizeElementError)
    expect(error?.message).toContain('"uint256[0]" consumes no bytes')
  })

  // Guards the forward-progress property itself: at the largest length the
  // decoder accepts, anything that iterated before throwing would exhaust
  // memory rather than fail. Only a throw on the *first* element passes.
  test('throws on the first element rather than after iterating', () => {
    const error = caught(() =>
      decodeAbiParameters(
        [{ type: 'tuple[]', components: [] }],
        dynamicArray(Number.MAX_SAFE_INTEGER),
      ),
    )
    expect(error).toBeInstanceOf(AbiDecodingZeroSizeElementError)
  })

  test('rejects a length word past the safe-integer ceiling', () => {
    const error = caught(() =>
      decodeAbiParameters(
        [{ type: 'tuple[]', components: [] }],
        `0x${word(32)}${'f'.repeat(64)}${word(0)}`,
      ),
    )
    expect(error?.name).toBe('IntegerOutOfRangeError')
  })

  test('rejects a zero-size element nested inside a tuple', () => {
    const error = caught(() =>
      decodeAbiParameters(
        [
          {
            type: 'tuple[]',
            components: [{ type: 'tuple', components: [] }],
          },
        ],
        dynamicArray(3_000_000),
      ),
    )
    expect(error).toBeInstanceOf(AbiDecodingZeroSizeElementError)
  })

  test('rejects an ABI-declared fixed length over a zero-size array', () => {
    const error = caught(() =>
      decodeAbiParameters([{ type: 'uint256[0][2000000]' }], `0x${word(0)}`),
    )
    expect(error).toBeInstanceOf(AbiDecodingZeroSizeElementError)
  })

  test('rejects an ABI-declared fixed length over an empty tuple', () => {
    const error = caught(() =>
      decodeAbiParameters(
        [{ type: 'tuple[2000000]', components: [] }],
        `0x${word(0)}`,
      ),
    )
    expect(error).toBeInstanceOf(AbiDecodingZeroSizeElementError)
  })

  // Arrays of dynamic children are terminated by the cursor instead: every
  // element reads a 32-byte offset slot, so the position walks off the data.
  test('leaves dynamic-child arrays bounded by the cursor', () => {
    const error = caught(() =>
      decodeAbiParameters([{ type: 'bytes[]' }], dynamicArray(3_000_000)),
    )
    expect(error?.name).toBe('PositionOutOfBoundsError')
  })

  test('still decodes a zero-length array to an empty array', () => {
    expect(
      decodeAbiParameters([{ type: 'uint256[0]' }], `0x${word(0)}`),
    ).toEqual([[]])
  })

  test('still decodes an empty dynamic array of zero-size elements', () => {
    expect(
      decodeAbiParameters(
        [{ type: 'tuple[]', components: [] }],
        dynamicArray(0),
      ),
    ).toEqual([[]])
  })

  test('leaves a normal dynamic array decoding unchanged', () => {
    const data = `0x${word(32)}${word(2)}${word(7)}${word(9)}` as `0x${string}`
    expect(decodeAbiParameters([{ type: 'uint256[]' }], data)).toEqual([
      [7n, 9n],
    ])
  })
})

// The payload is bytes: a hex string with an odd nibble count is not a byte
// string, and `hexToBytes` would left-pad it — shifting the whole payload by
// four bits and decoding a wrong value with no error. Canonical ABI data is
// also always a whole number of 32-byte words.
describe('payload shape validation', () => {
  const uint256 = [{ type: 'uint256' }] as const
  const full = `0x${word(255)}` as const

  test('rejects an odd-length hex payload instead of decoding a shifted value', () => {
    const truncated = full.slice(0, -1) as `0x${string}`
    const error = caught(() => decodeAbiParameters(uint256, truncated))
    expect(error).toBeInstanceOf(InvalidHexValueError)
    expect(error).toBeInstanceOf(BaseError)
    // Before the guard this silently returned 15n (255 >> 4).
    expect(error?.message).toContain('odd length')
  })

  test('rejects a hex payload that is not a whole number of 32-byte words', () => {
    const error = caught(() => decodeAbiParameters(uint256, `${full}abab`))
    expect(error).toBeInstanceOf(AbiDecodingDataSizeInvalidError)
    expect(error?.message).toContain('increments of 32 bytes')
  })

  test('rejects a misaligned ByteArray payload too', () => {
    const error = caught(() => decodeAbiParameters(uint256, new Uint8Array(33)))
    expect(error).toBeInstanceOf(AbiDecodingDataSizeInvalidError)
  })

  test('still decodes a well-formed payload', () => {
    expect(decodeAbiParameters(uint256, full)).toStrictEqual([255n])
    expect(
      decodeAbiParameters(uint256, new Uint8Array(32).fill(0, 0, 31)),
    ).toStrictEqual([0n])
    // No params + empty data stays legal.
    expect(decodeAbiParameters([], '0x')).toStrictEqual([])
  })

  test('the guard reaches callers that decode node data (decodeFunctionResult)', () => {
    const abi = [
      {
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
      },
    ] as const
    const error = caught(() =>
      decodeFunctionResult({
        abi,
        functionName: 'balanceOf',
        data: full.slice(0, -1) as `0x${string}`,
      }),
    )
    expect(error).toBeInstanceOf(InvalidHexValueError)
  })
})
