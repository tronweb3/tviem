import { describe, expect, test } from 'vitest'
import {
  AbiEncodingArrayLengthMismatchError,
  UnsupportedPackedAbiType,
} from '../../../src/errors/abi.js'
import { InvalidHexValueError } from '../../../src/errors/encoding.js'
import { encodePacked } from '../../../src/utils/abi/encodePacked.js'
import {
  type FixtureParameter,
  loadPackedFixtures,
  reviveValue,
} from '../../fixtures/abi/loader.js'

const fixtures = loadPackedFixtures()

describe('encodePacked (gold fixtures)', () => {
  test.each(
    fixtures.map((fixture) => [fixture.name, fixture] as const),
  )('%s encodes byte-exact', (_name, fixture) => {
    const values = fixture.types.map((type, i) =>
      reviveValue({ type } as FixtureParameter, fixture.values[i]!),
    )
    expect(encodePacked(fixture.types, values as never)).toBe(fixture.encoded)
  })

  test('covers all 20 gold vectors', () => {
    expect(fixtures.length).toBe(20)
  })
})

describe('encodePacked (units)', () => {
  test('static types keep their natural width (no padding)', () => {
    expect(
      encodePacked(
        ['address', 'uint256'],
        ['TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe', 1000000n],
      ),
    ).toBe(
      '0x0123456789abcdef0123456789abcdef0123456700000000000000000000000000000000000000000000000000000000000f4240',
    )
    expect(encodePacked(['uint8'], [255n])).toBe('0xff')
    expect(encodePacked(['bool'], [true])).toBe('0x01')
    expect(encodePacked(['bool'], [false])).toBe('0x00')
    expect(encodePacked(['bytes1'], ['0xff'])).toBe('0xff')
  })

  test('dynamic bytes / string are raw and unpadded', () => {
    expect(encodePacked(['string'], ['hello test'])).toBe(
      '0x68656c6c6f2074657374',
    )
    expect(encodePacked(['bytes'], ['0x0102030405'])).toBe('0x0102030405')
    expect(encodePacked(['bytes'], ['0x'])).toBe('0x')
  })

  test('array elements are padded to 32-byte words', () => {
    expect(encodePacked(['uint256[]'], [[1n, 1000000n]])).toBe(
      '0x000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000f4240',
    )
    expect(
      encodePacked(
        ['address[2]'],
        [
          [
            'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC',
            'TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe',
          ],
        ],
      ),
    ).toBe(
      '0x0000000000000000000000007e5f4552091a69125d5dfcb7b8c2659029395bdf0000000000000000000000000123456789abcdef0123456789abcdef01234567',
    )
  })

  test('trcToken packs exactly like uint256', () => {
    // A lone `trcToken` occupies a full 32-byte word.
    expect(encodePacked(['trcToken'], [1002000n])).toBe(
      '0x00000000000000000000000000000000000000000000000000000000000f4a10',
    )
    // Byte-identical to the equivalent uint256 encoding — scalar, array, and
    // when mixed with other packed types. (No `as never`: the widened
    // `PackedAbiType` types `trcToken` values as `bigint | number`.)
    expect(encodePacked(['trcToken'], [1002000n])).toBe(
      encodePacked(['uint256'], [1002000n]),
    )
    expect(encodePacked(['trcToken[]'], [[1n, 1002000n]])).toBe(
      encodePacked(['uint256[]'], [[1n, 1002000n]]),
    )
    expect(
      encodePacked(
        ['address', 'trcToken'],
        ['TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe', 1002000n],
      ),
    ).toBe(
      encodePacked(
        ['address', 'uint256'],
        ['TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe', 1002000n],
      ),
    )
  })

  test('rejects unpackable nested dynamic / tuple types', () => {
    expect(() => encodePacked(['tuple'], [[1n]] as never)).toThrow(
      UnsupportedPackedAbiType,
    )
    expect(() => encodePacked(['string[]'], [['a']] as never)).toThrow(
      UnsupportedPackedAbiType,
    )
    expect(() => encodePacked(['uint256[][]'], [[[1n]]] as never)).toThrow(
      UnsupportedPackedAbiType,
    )
  })

  test('rejects a types/values length mismatch', () => {
    expect(() => encodePacked(['uint256', 'uint256'], [1n] as never)).toThrow()
  })
})

function caught(fn: () => unknown): Error | undefined {
  try {
    fn()
    return undefined
  } catch (error) {
    return error as Error
  }
}

// `abi.encodePacked` output is fed to keccak256 to build signed digests, so a
// byte string that is off by half a byte — or an array whose declared length is
// ignored — yields a hash that can never match the on-chain one.
describe('encodePacked (malformed input)', () => {
  test('rejects an odd-length `bytesN` value instead of emitting half a byte', () => {
    const error = caught(() =>
      encodePacked(['bytes1', 'bytes1'], ['0x1', '0xff']),
    )
    expect(error).toBeInstanceOf(InvalidHexValueError)
    // Before the guard this returned '0x1ff' — three nibbles, not a byte string,
    // with every following field shifted by half a byte.
  })

  test('rejects an odd-length dynamic `bytes` value', () => {
    const error = caught(() => encodePacked(['bytes', 'uint8'], ['0x1', 1n]))
    expect(error).toBeInstanceOf(InvalidHexValueError)
    expect(error?.message).toContain('"0x1"')
  })

  test('rejects a fixed-size array whose value length differs from the declared one', () => {
    const short = caught(() => encodePacked(['uint256[3]'], [[1n]]))
    expect(short).toBeInstanceOf(AbiEncodingArrayLengthMismatchError)
    // Pin the operands: transposing them ships a message that reads
    // "Expected length: 1 / Given length: 3" for this very call.
    expect(short?.message).toContain('uint256[3]')
    expect(short?.message).toContain('Expected length: 3')
    expect(short?.message).toContain('Given length: 1')
    const long = caught(() =>
      encodePacked(['uint256[2]'], [[1n, 2n, 3n, 4n, 5n]]),
    )
    expect(long).toBeInstanceOf(AbiEncodingArrayLengthMismatchError)
    expect(long?.message).toContain('Expected length: 2')
    expect(long?.message).toContain('Given length: 5')
  })

  test('rejects an odd-length `bytesN` element inside a fixed-size array', () => {
    // Array elements are right-padded to a 32-byte word, so a missing nibble
    // is baked into the digest with no visible shift to give it away: before
    // the guard this returned '0x1230…0000' + '0x1234…0000'.
    const error = caught(() =>
      encodePacked(['bytes2[2]'], [['0x123', '0x1234']]),
    )
    expect(error).toBeInstanceOf(InvalidHexValueError)
  })

  test('checks hex well-formedness before the `bytesN` width check', () => {
    // `size('0x1')` rounds up to 1, so before the guard this reported a width
    // mismatch (bytes1 vs bytes2) and masked the real problem.
    const error = caught(() => encodePacked(['bytes2'], ['0x1']))
    expect(error).toBeInstanceOf(InvalidHexValueError)
  })

  test('a matching fixed-size array still encodes one 32-byte word per element', () => {
    const encoded = encodePacked(['uint256[3]'], [[1n, 2n, 3n]])
    expect((encoded.length - 2) / 2).toBe(96)
  })

  test('dynamic arrays are unaffected by the fixed-length check', () => {
    expect((encodePacked(['uint256[]'], [[1n, 2n]]).length - 2) / 2).toBe(64)
    expect(encodePacked(['uint256[]'], [[]])).toBe('0x')
  })

  test('rejects a number past 2^53 instead of encoding the rounded value', () => {
    // The literal 2^53+1 is already 2^53 by the time it is a JS number, so
    // BigInt() would encode a value the caller never wrote.
    const error = caught(() =>
      encodePacked(['uint256'], [Number.MAX_SAFE_INTEGER + 2]),
    )
    expect(error?.message).toMatch(/not a safe integer/)
  })

  test('rejects a fractional / NaN number for an integer type', () => {
    expect(caught(() => encodePacked(['uint256'], [1.5]))?.message).toMatch(
      /not a safe integer/,
    )
    expect(
      caught(() => encodePacked(['int64'], [Number.NaN]))?.message,
    ).toMatch(/not a safe integer/)
  })

  test('a safe-integer number and a bigint still encode', () => {
    expect(() => encodePacked(['uint256'], [42])).not.toThrow()
    expect(() => encodePacked(['uint256'], [9007199254740993n])).not.toThrow()
  })

  test('well-formed byte values still encode unpadded', () => {
    expect(encodePacked(['bytes1', 'bytes1'], ['0x01', '0xff'])).toBe('0x01ff')
    expect(encodePacked(['bytes', 'uint8'], ['0x01', 1n])).toBe('0x0101')
  })
})
