import { describe, expect, test } from 'vitest'
import { version } from '../../../src/errors/version.js'

import { pad, padBytes, padHex } from '../../../src/utils/data/pad.js'

test('default', () => {
  expect(pad('0xa4e12a45')).toMatchInlineSnapshot(
    '"0x00000000000000000000000000000000000000000000000000000000a4e12a45"',
  )

  expect(pad(new Uint8Array([1, 122, 51, 123]))).toMatchInlineSnapshot(
    `
    Uint8Array [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      122,
      51,
      123,
    ]
  `,
  )
})

describe('hex', () => {
  test('default', () => {
    expect(padHex('0x1')).toMatchInlineSnapshot(
      '"0x0000000000000000000000000000000000000000000000000000000000000001"',
    )

    expect(padHex('0xa4e12a45')).toMatchInlineSnapshot(
      '"0x00000000000000000000000000000000000000000000000000000000a4e12a45"',
    )

    expect(padHex('0x1a4e12a45')).toMatchInlineSnapshot(
      '"0x00000000000000000000000000000000000000000000000000000001a4e12a45"',
    )

    expect(() =>
      padHex(
        '0x1a4e12a45a21323123aaa87a897a897a898a6567a578a867a98778a667a85a875a87a6a787a65a675a6a9',
      ),
    ).toThrowError(
      expect.objectContaining({
        name: 'SizeExceedsPaddingSizeError',
        message: `Hex size (43) exceeds padding size (32).

Version: @tronweb3/tviem@${version}`,
      }),
    )
  })

  test('args: size', () => {
    expect(padHex('0x1', { size: 4 })).toMatchInlineSnapshot('"0x00000001"')

    expect(padHex('0xa4e12a45', { size: 4 })).toMatchInlineSnapshot(
      '"0xa4e12a45"',
    )

    expect(padHex('0xa4e12a45ab', { size: null })).toMatchInlineSnapshot(
      '"0xa4e12a45ab"',
    )

    expect(() => padHex('0x1a4e12a45', { size: 4 })).toThrowError(
      expect.objectContaining({
        name: 'SizeExceedsPaddingSizeError',
        message: `Hex size (5) exceeds padding size (4).

Version: @tronweb3/tviem@${version}`,
      }),
    )
  })

  test('args: dir', () => {
    expect(padHex('0x1', { dir: 'right' })).toMatchInlineSnapshot(
      '"0x1000000000000000000000000000000000000000000000000000000000000000"',
    )

    expect(padHex('0xa4e12a45', { dir: 'right' })).toMatchInlineSnapshot(
      '"0xa4e12a4500000000000000000000000000000000000000000000000000000000"',
    )

    expect(padHex('0x1a4e12a45', { dir: 'right' })).toMatchInlineSnapshot(
      '"0x1a4e12a450000000000000000000000000000000000000000000000000000000"',
    )
  })
})

describe('bytes', () => {
  test('default', () => {
    expect(padBytes(new Uint8Array([1]))).toMatchInlineSnapshot(
      `
      Uint8Array [
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
      ]
    `,
    )

    expect(padBytes(new Uint8Array([1, 122, 51, 123]))).toMatchInlineSnapshot(
      `
      Uint8Array [
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        122,
        51,
        123,
      ]
    `,
    )

    expect(() =>
      padBytes(
        new Uint8Array([
          1, 122, 51, 123, 1, 122, 51, 123, 1, 122, 51, 123, 1, 122, 51, 123, 1,
          122, 51, 123, 1, 122, 51, 123, 1, 122, 51, 123, 1, 122, 51, 123, 1,
          122, 51, 123, 1, 122, 51, 123, 1, 122, 51, 123,
        ]),
      ),
    ).toThrowError(
      expect.objectContaining({
        name: 'SizeExceedsPaddingSizeError',
        message: `Bytes size (44) exceeds padding size (32).

Version: @tronweb3/tviem@${version}`,
      }),
    )
  })

  test('args: size', () => {
    expect(padBytes(new Uint8Array([1]), { size: 4 })).toMatchInlineSnapshot(
      `
      Uint8Array [
        0,
        0,
        0,
        1,
      ]
    `,
    )

    expect(
      padBytes(new Uint8Array([1, 122, 51, 123]), { size: 4 }),
    ).toMatchInlineSnapshot(
      `
      Uint8Array [
        1,
        122,
        51,
        123,
      ]
    `,
    )

    expect(
      padBytes(new Uint8Array([1, 122, 51, 123, 11, 23]), { size: null }),
    ).toMatchInlineSnapshot(
      `
      Uint8Array [
        1,
        122,
        51,
        123,
        11,
        23,
      ]
    `,
    )

    expect(() =>
      padBytes(new Uint8Array([1, 122, 51, 123, 11]), { size: 4 }),
    ).toThrowError(
      expect.objectContaining({
        name: 'SizeExceedsPaddingSizeError',
        message: `Bytes size (5) exceeds padding size (4).

Version: @tronweb3/tviem@${version}`,
      }),
    )
  })

  test('args: dir', () => {
    expect(
      padBytes(new Uint8Array([1]), { dir: 'right' }),
    ).toMatchInlineSnapshot(
      `
      Uint8Array [
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
      ]
    `,
    )

    expect(
      padBytes(new Uint8Array([1, 122, 51, 123]), { dir: 'right' }),
    ).toMatchInlineSnapshot(
      `
      Uint8Array [
        1,
        122,
        51,
        123,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
      ]
    `,
    )

    expect(
      padBytes(new Uint8Array([1, 122, 51, 123, 11]), { dir: 'right' }),
    ).toMatchInlineSnapshot(
      `
      Uint8Array [
        1,
        122,
        51,
        123,
        11,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
      ]
    `,
    )
  })
})

test('@tronweb3/tviem: pads to 32 bytes on the left by default', () => {
  expect(pad('0x1')).toBe(
    '0x0000000000000000000000000000000000000000000000000000000000000001',
  )
})
