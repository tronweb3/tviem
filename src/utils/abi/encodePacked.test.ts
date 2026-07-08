import { describe, expect, test } from 'vitest'

import {
  type FixtureParameter,
  loadPackedFixtures,
  reviveValue,
} from '../../../test/fixtures/abi/loader.js'
import { UnsupportedPackedAbiType } from '../../errors/abi.js'
import { encodePacked } from './encodePacked.js'

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
        ['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 1000000n],
      ),
    ).toBe(
      '0xa614f803b6fd780986a42c78ec9c7f77e6ded13c00000000000000000000000000000000000000000000000000000000000f4240',
    )
    expect(encodePacked(['uint8'], [255n])).toBe('0xff')
    expect(encodePacked(['bool'], [true])).toBe('0x01')
    expect(encodePacked(['bool'], [false])).toBe('0x00')
    expect(encodePacked(['bytes1'], ['0xff'])).toBe('0xff')
  })

  test('dynamic bytes / string are raw and unpadded', () => {
    expect(encodePacked(['string'], ['hello omni'])).toBe(
      '0x68656c6c6f206f6d6e69',
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
            'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          ],
        ],
      ),
    ).toBe(
      '0x0000000000000000000000007e5f4552091a69125d5dfcb7b8c2659029395bdf000000000000000000000000a614f803b6fd780986a42c78ec9c7f77e6ded13c',
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
