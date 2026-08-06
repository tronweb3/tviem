import { describe, expect, test } from 'vitest'
import { UnsupportedPackedAbiType } from '../../../src/errors/abi.js'
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
