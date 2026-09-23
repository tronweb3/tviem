import { describe, expect, test } from 'vitest'
import {
  AbiDecodingDataSizeInvalidError,
  AbiDecodingZeroSizeElementError,
  InvalidAbiDecodingTypeError,
  InvalidAbiEncodingTypeError,
} from '../../../src/errors/abi.js'
import { BaseError } from '../../../src/errors/base.js'
import {
  InvalidHexValueError,
  MissingHexPrefixError,
} from '../../../src/errors/encoding.js'
import { decodeAbiParameters } from '../../../src/utils/abi/decodeAbiParameters.js'
import { decodeFunctionResult } from '../../../src/utils/abi/decodeFunctionResult.js'
import { encodeAbiParameters } from '../../../src/utils/abi/encodeAbiParameters.js'

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
// four bits and decoding a wrong value with no error. Whole trailing bytes
// past the encoding are a different matter: decoding is head-driven and never
// reads them, and TIP-2771 forwarder calldata legitimately carries a raw
// 20-byte sender suffix — so the generic decoder tolerates them, while
// decodeFunctionResult (whose node return data is always word-aligned)
// enforces alignment at its own boundary.
describe('payload shape validation', () => {
  const uint256 = [{ type: 'uint256' }] as const
  const full = `0x${word(255)}` as const
  const balanceOfAbi = [
    {
      type: 'function',
      name: 'balanceOf',
      stateMutability: 'view',
      inputs: [{ name: 'owner', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    },
  ] as const

  test('rejects an odd-length hex payload instead of decoding a shifted value', () => {
    const truncated = full.slice(0, -1) as `0x${string}`
    const error = caught(() => decodeAbiParameters(uint256, truncated))
    expect(error).toBeInstanceOf(InvalidHexValueError)
    expect(error).toBeInstanceOf(BaseError)
    // Before the guard this silently returned 15n (255 >> 4).
    expect(error?.message).toContain('odd length')
  })

  // java-tron returns `constant_result[0]`, `contractResult[0]` and
  // `parameter.value.data` as BARE hex. `hexToBytes` slices two characters
  // off unconditionally, so a bare payload loses its first byte: every word
  // reads one byte late, and where the data holds more words than the params
  // consume, the shifted value surfaces with no error. The `Hex` type shields
  // TypeScript callers; plain JS and an `as Hex` cast are not shielded.
  test('rejects a bare (unprefixed) hex payload instead of dropping its first byte', () => {
    // Two words, 1 and 2. Before the guard this decoded 256n: the first word
    // was read one byte late, so its `…01` became `…0100`.
    const bare = `${word(1)}${word(2)}` as `0x${string}`
    const error = caught(() => decodeAbiParameters(uint256, bare))
    expect(error).toBeInstanceOf(MissingHexPrefixError)
    expect(error).toBeInstanceOf(BaseError)
    expect(error?.message).toContain('not 0x-prefixed')
    // Neither an upper-case prefix nor the empty string is `Hex`.
    expect(
      caught(() =>
        decodeAbiParameters(uint256, `0X${word(255)}` as `0x${string}`),
      ),
    ).toBeInstanceOf(MissingHexPrefixError)
    expect(
      caught(() => decodeAbiParameters(uint256, '' as `0x${string}`)),
    ).toBeInstanceOf(MissingHexPrefixError)
  })

  test('the prefix guard reaches callers that decode node data (decodeFunctionResult)', () => {
    // Before the guard decodeFunctionResult converted first, and its
    // alignment check reported a 31- or 63-byte payload — naming the wrong
    // fault for a value that was simply never prefixed.
    for (const data of [word(255), `${word(1)}${word(2)}`]) {
      const error = caught(() =>
        decodeFunctionResult({
          abi: balanceOfAbi,
          functionName: 'balanceOf',
          data: data as `0x${string}`,
        }),
      )
      expect(error).toBeInstanceOf(MissingHexPrefixError)
    }
  })

  test('tolerates whole trailing bytes past the encoding', () => {
    expect(decodeAbiParameters(uint256, `${full}abab`)).toStrictEqual([255n])
    expect(decodeAbiParameters(uint256, new Uint8Array(33))).toStrictEqual([0n])
  })

  test('decodes params carrying a TIP-2771 20-byte sender suffix', () => {
    const sender = '2b5ad5c4795c026514f8317c7a215e218dccd6cf'
    // Static param: the suffix sits past the head and is never read.
    expect(decodeAbiParameters(uint256, `${full}${sender}`)).toStrictEqual([
      255n,
    ])
    // Dynamic param: tails are located by offset + own length word, both
    // before the suffix, so the value decodes unchanged.
    const encoded = encodeAbiParameters([{ type: 'string' }], ['hello'])
    expect(
      decodeAbiParameters(
        [{ type: 'string' }],
        `${encoded}${sender}` as `0x${string}`,
      ),
    ).toStrictEqual(['hello'])
  })

  test('still decodes a well-formed payload', () => {
    expect(decodeAbiParameters(uint256, full)).toStrictEqual([255n])
    expect(
      decodeAbiParameters(uint256, new Uint8Array(32).fill(0, 0, 31)),
    ).toStrictEqual([0n])
    // No params + empty data stays legal.
    expect(decodeAbiParameters([], '0x')).toStrictEqual([])
  })

  test('the odd-nibble guard reaches callers that decode node data (decodeFunctionResult)', () => {
    // 63 nibbles round to a word-aligned 32 bytes and 61 to a misaligned 31,
    // so together they pin that odd-length hex defers to the invalid-hex
    // error instead of being size-counted (with any rounding) by
    // decodeFunctionResult's alignment check.
    for (const data of [full.slice(0, -1), full.slice(0, -3)]) {
      const error = caught(() =>
        decodeFunctionResult({
          abi: balanceOfAbi,
          functionName: 'balanceOf',
          data: data as `0x${string}`,
        }),
      )
      expect(error).toBeInstanceOf(InvalidHexValueError)
    }
  })

  test('decodeFunctionResult still rejects misaligned return data', () => {
    // Return data (`constant_result`) is always a whole number of 32-byte
    // words — no calldata-style suffix can occur there — so misalignment
    // means a lossy/corrupt node response and must keep failing loudly even
    // though the generic decoder now tolerates trailing bytes.
    for (const data of [`${full}abab` as `0x${string}`, new Uint8Array(33)]) {
      const error = caught(() =>
        decodeFunctionResult({
          abi: balanceOfAbi,
          functionName: 'balanceOf',
          data,
        }),
      )
      expect(error).toBeInstanceOf(AbiDecodingDataSizeInvalidError)
      expect(error?.message).toContain('increments of 32 bytes')
    }
  })

  test('non-hex return data is reported as invalid hex, not as a byte count', () => {
    // The alignment check counts characters, so it must not run before the
    // payload is known to be hex at all: a stray `0x` (a node handing back an
    // already-prefixed `constant_result`) or any garbled body would otherwise
    // be reported as a byte size the string never had, naming the wrong fault.
    for (const data of [`0x0x${word(255)}`, '0xzz'] as `0x${string}`[]) {
      const error = caught(() =>
        decodeFunctionResult({
          abi: balanceOfAbi,
          functionName: 'balanceOf',
          data,
        }),
      )
      expect(error).toBeInstanceOf(BaseError)
      expect(error).not.toBeInstanceOf(AbiDecodingDataSizeInvalidError)
      expect(error?.message).toContain('Invalid byte sequence')
    }
  })
})

// Every other bad-input path in the codec produces a BaseError subclass, and
// the *ErrorType unions promise exactly that set. A parameter descriptor that
// is missing `type` — or is null — used to escape as a bare TypeError, which
// fails `instanceof BaseError` and names neither the parameter nor a version.
describe('malformed ABI parameters', () => {
  const data = `0x${word(1)}` as const

  test('a parameter without a `type` throws a typed error', () => {
    const error = caught(() => decodeAbiParameters([{}] as never, data))
    expect(error).toBeInstanceOf(InvalidAbiDecodingTypeError)
    expect(error).toBeInstanceOf(BaseError)
  })

  test('a null parameter throws a typed error', () => {
    const error = caught(() => decodeAbiParameters([null] as never, data))
    expect(error).toBeInstanceOf(InvalidAbiDecodingTypeError)
  })

  test('a non-string `type` throws a typed error', () => {
    const error = caught(() =>
      decodeAbiParameters([{ type: 7 }] as never, data),
    )
    expect(error).toBeInstanceOf(InvalidAbiDecodingTypeError)
  })

  test('a well-formed but unknown type still reports the same error', () => {
    const error = caught(() => decodeAbiParameters([{ type: 'wat' }], data))
    expect(error).toBeInstanceOf(InvalidAbiDecodingTypeError)
    expect(error?.message).toContain('"wat"')
  })

  test('the size guard formats malformed params instead of crashing', () => {
    // Constructing AbiDecodingDataSizeTooSmallError formats the params, so a
    // malformed one must not throw from inside the error path itself.
    const error = caught(() => decodeAbiParameters([{}, {}] as never, data))
    expect(error).toBeInstanceOf(BaseError)
  })

  test('the encode side reports a typed error too', () => {
    const error = caught(() =>
      encodeAbiParameters([{}] as never, [1n] as never),
    )
    expect(error).toBeInstanceOf(InvalidAbiEncodingTypeError)
    expect(error).toBeInstanceOf(BaseError)
  })
})
