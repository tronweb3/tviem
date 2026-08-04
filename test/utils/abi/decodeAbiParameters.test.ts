import { describe, expect, test } from 'vitest'
import { decodeAbiParameters } from '../../../src/utils/abi/decodeAbiParameters.js'

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
    expect(error?.name).toBe('AbiDecodingZeroSizeElementError')
    expect(error?.message).toContain('consumes no bytes')
  })

  test('rejects a data-supplied length for a zero-length inner array', () => {
    const error = caught(() =>
      decodeAbiParameters([{ type: 'uint256[0][]' }], dynamicArray(3_000_000)),
    )
    expect(error?.name).toBe('AbiDecodingZeroSizeElementError')
  })

  test('rejects an ABI-declared fixed length over a zero-size element', () => {
    const error = caught(() =>
      decodeAbiParameters([{ type: 'uint256[0][2000000]' }], `0x${word(0)}`),
    )
    expect(error?.name).toBe('AbiDecodingZeroSizeElementError')
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
