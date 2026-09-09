import { describe, expect, test } from 'vitest'
import { version } from '../../../src/errors/version.js'

import {
  boolToHex,
  bytesToHex,
  numberToHex,
  stringToHex,
  toHex,
} from '../../../src/utils/encoding/toHex.js'

describe('converts numbers to hex', () => {
  test('default', () => {
    expect(toHex(0)).toMatchInlineSnapshot('"0x0"')
    expect(toHex(7)).toMatchInlineSnapshot('"0x7"')
    expect(toHex(69)).toMatchInlineSnapshot('"0x45"')
    expect(toHex(420)).toMatchInlineSnapshot('"0x1a4"')

    expect(numberToHex(0)).toMatchInlineSnapshot('"0x0"')
    expect(numberToHex(7)).toMatchInlineSnapshot('"0x7"')
    expect(numberToHex(69)).toMatchInlineSnapshot('"0x45"')
    expect(numberToHex(420)).toMatchInlineSnapshot('"0x1a4"')

    expect(() =>
      // biome-ignore lint/correctness/noPrecisionLoss: precision loss expected for test
      numberToHex(420182738912731283712937129),
    ).toThrowError(
      expect.objectContaining({
        name: 'IntegerOutOfRangeError',
        message: `Number "4.2018273891273126e+26" is not in safe integer range (-9007199254740991 to 9007199254740991)

Version: @tronweb3/tviem@${version}`,
      }),
    )
    expect(() => numberToHex(-69)).toThrowError(
      expect.objectContaining({
        name: 'IntegerOutOfRangeError',
        message: `Number "-69" is not in safe integer range (0 to 9007199254740991)

Version: @tronweb3/tviem@${version}`,
      }),
    )
  })

  test('args: size', () => {
    expect(numberToHex(7, { size: 1 })).toBe('0x07')
    expect(numberToHex(10, { size: 2 })).toBe('0x000a')
    expect(numberToHex(69, { size: 4 })).toBe('0x00000045')
    expect(numberToHex(69, { size: 32 })).toBe(
      '0x0000000000000000000000000000000000000000000000000000000000000045',
    )

    expect(() => numberToHex(-7, { size: 1 })).toThrowError(
      expect.objectContaining({
        name: 'IntegerOutOfRangeError',
        message: `Number "-7" is not in safe 8-bit unsigned integer range (0 to 255)

Version: @tronweb3/tviem@${version}`,
      }),
    )
    expect(() => numberToHex(256, { size: 1 })).toThrowError(
      expect.objectContaining({
        name: 'IntegerOutOfRangeError',
        message: `Number "256" is not in safe 8-bit unsigned integer range (0 to 255)

Version: @tronweb3/tviem@${version}`,
      }),
    )
    expect(() => numberToHex(65536, { size: 2 })).toThrowError(
      expect.objectContaining({
        name: 'IntegerOutOfRangeError',
        message: `Number "65536" is not in safe 16-bit unsigned integer range (0 to 65535)

Version: @tronweb3/tviem@${version}`,
      }),
    )
  })

  test('rejects unsafe-integer numbers before BigInt conversion', () => {
    // with size: previously encoded the IEEE-754-rounded value silently
    expect(() => numberToHex(2 ** 53, { size: 32 })).toThrowError(
      expect.objectContaining({
        name: 'IntegerOutOfRangeError',
        message: `Number "9007199254740992" is not in safe integer range (-9007199254740991 to 9007199254740991)

Version: @tronweb3/tviem@${version}`,
      }),
    )
    expect(() =>
      numberToHex(-(2 ** 53), { size: 32, signed: true }),
    ).toThrowError(
      expect.objectContaining({
        name: 'IntegerOutOfRangeError',
        message: `Number "-9007199254740992" is not in safe integer range (-9007199254740991 to 9007199254740991)

Version: @tronweb3/tviem@${version}`,
      }),
    )

    // fractional and non-finite numbers: previously a raw RangeError from BigInt()
    expect(() => numberToHex(1.5)).toThrowError(
      expect.objectContaining({
        name: 'IntegerOutOfRangeError',
        message: `Number "1.5" is not in safe integer range (-9007199254740991 to 9007199254740991)

Version: @tronweb3/tviem@${version}`,
      }),
    )
    expect(() => numberToHex(1.5, { size: 1 })).toThrowError(
      expect.objectContaining({
        name: 'IntegerOutOfRangeError',
        message: `Number "1.5" is not in safe integer range (-9007199254740991 to 9007199254740991)

Version: @tronweb3/tviem@${version}`,
      }),
    )
    expect(() => numberToHex(Number.NaN, { size: 32 })).toThrowError(
      expect.objectContaining({
        name: 'IntegerOutOfRangeError',
        message: `Number "NaN" is not in safe integer range (-9007199254740991 to 9007199254740991)

Version: @tronweb3/tviem@${version}`,
      }),
    )

    // bigint inputs past 2^53 are exact and stay accepted
    expect(numberToHex(2n ** 53n, { size: 32 })).toBe(
      '0x0000000000000000000000000000000000000000000000000020000000000000',
    )
  })

  test('args: signed', () => {
    expect(numberToHex(32, { size: 1, signed: true })).toBe('0x20')
    expect(
      numberToHex(-32, {
        size: 1,
        signed: true,
      }),
    ).toBe('0xe0')
    expect(
      numberToHex(-32, {
        size: 4,
        signed: true,
      }),
    ).toBe('0xffffffe0')

    expect(numberToHex(127, { size: 2, signed: true })).toBe('0x007f')
    expect(numberToHex(-127, { size: 2, signed: true })).toBe('0xff81')
    expect(numberToHex(32767, { size: 2, signed: true })).toBe('0x7fff')
    expect(numberToHex(-32768, { size: 2, signed: true })).toBe('0x8000')
    expect(() => numberToHex(32768, { size: 2, signed: true })).toThrowError(
      expect.objectContaining({
        name: 'IntegerOutOfRangeError',
        message: `Number "32768" is not in safe 16-bit signed integer range (-32768 to 32767)

Version: @tronweb3/tviem@${version}`,
      }),
    )
    expect(() => numberToHex(-32769, { size: 2, signed: true })).toThrowError(
      expect.objectContaining({
        name: 'IntegerOutOfRangeError',
        message: `Number "-32769" is not in safe 16-bit signed integer range (-32768 to 32767)

Version: @tronweb3/tviem@${version}`,
      }),
    )
  })
})

describe('converts bigints to hex', () => {
  test('default', () => {
    expect(toHex(0)).toMatchInlineSnapshot('"0x0"')
    expect(toHex(7n)).toMatchInlineSnapshot('"0x7"')
    expect(toHex(69n)).toMatchInlineSnapshot('"0x45"')
    expect(toHex(420n)).toMatchInlineSnapshot('"0x1a4"')
    expect(
      toHex(4206942069420694206942069420694206942069n),
    ).toMatchInlineSnapshot('"0xc5cf39211876fb5e5884327fa56fc0b75"')

    expect(numberToHex(0)).toMatchInlineSnapshot('"0x0"')
    expect(numberToHex(7n)).toMatchInlineSnapshot('"0x7"')
    expect(numberToHex(69n)).toMatchInlineSnapshot('"0x45"')
    expect(numberToHex(420n)).toMatchInlineSnapshot('"0x1a4"')
    expect(
      numberToHex(4206942069420694206942069420694206942069n),
    ).toMatchInlineSnapshot('"0xc5cf39211876fb5e5884327fa56fc0b75"')

    expect(() => numberToHex(-69n)).toThrowError(
      expect.objectContaining({
        name: 'IntegerOutOfRangeError',
        message: `Number "-69n" is not in safe integer range (above 0n)

Version: @tronweb3/tviem@${version}`,
      }),
    )
  })

  test('args: size', () => {
    expect(numberToHex(7n, { size: 1 })).toBe('0x07')
    expect(numberToHex(10n, { size: 2 })).toBe('0x000a')
    expect(numberToHex(69n, { size: 4 })).toBe('0x00000045')
    expect(numberToHex(6123123124124124213123129n, { size: 32 })).toBe(
      '0x00000000000000000000000000000000000000000005109f2b700e30e5b39839',
    )

    expect(() => numberToHex(-7n, { size: 1 })).toThrowError(
      expect.objectContaining({
        name: 'IntegerOutOfRangeError',
        message: `Number "-7n" is not in safe 8-bit unsigned integer range (0n to 255n)

Version: @tronweb3/tviem@${version}`,
      }),
    )
    expect(() => numberToHex(256n, { size: 1 })).toThrowError(
      expect.objectContaining({
        name: 'IntegerOutOfRangeError',
        message: `Number "256n" is not in safe 8-bit unsigned integer range (0n to 255n)

Version: @tronweb3/tviem@${version}`,
      }),
    )
    expect(() => numberToHex(65536n, { size: 2 })).toThrowError(
      expect.objectContaining({
        name: 'IntegerOutOfRangeError',
        message: `Number "65536n" is not in safe 16-bit unsigned integer range (0n to 65535n)

Version: @tronweb3/tviem@${version}`,
      }),
    )
    expect(() => numberToHex(18446744073709551616n, { size: 8 })).toThrowError(
      expect.objectContaining({
        name: 'IntegerOutOfRangeError',
        message: `Number "18446744073709551616n" is not in safe 64-bit unsigned integer range (0n to 18446744073709551615n)

Version: @tronweb3/tviem@${version}`,
      }),
    )
  })

  test('args: signed', () => {
    expect(numberToHex(32n, { size: 1, signed: true })).toBe('0x20')
    expect(
      numberToHex(-32n, {
        size: 1,
        signed: true,
      }),
    ).toBe('0xe0')
    expect(
      numberToHex(-32n, {
        size: 4,
        signed: true,
      }),
    ).toBe('0xffffffe0')

    expect(numberToHex(127n, { size: 2, signed: true })).toBe('0x007f')
    expect(numberToHex(-127n, { size: 2, signed: true })).toBe('0xff81')
    expect(numberToHex(32767n, { size: 2, signed: true })).toBe('0x7fff')
    expect(numberToHex(-32768n, { size: 2, signed: true })).toBe('0x8000')

    expect(numberToHex(12312312312312312412n, { size: 32, signed: true })).toBe(
      '0x000000000000000000000000000000000000000000000000aade1ed08b0b325c',
    )
    expect(
      numberToHex(-12312312312312312412n, { size: 32, signed: true }),
    ).toBe('0xffffffffffffffffffffffffffffffffffffffffffffffff5521e12f74f4cda4')

    expect(() =>
      numberToHex(170141183460469231731687303715884105728n, {
        size: 16,
        signed: true,
      }),
    ).toThrowError(
      expect.objectContaining({
        name: 'IntegerOutOfRangeError',
        message: `Number "170141183460469231731687303715884105728n" is not in safe 128-bit signed integer range (-170141183460469231731687303715884105728n to 170141183460469231731687303715884105727n)

Version: @tronweb3/tviem@${version}`,
      }),
    )
    expect(() =>
      numberToHex(-170141183460469231731687303715884105729n, {
        size: 16,
        signed: true,
      }),
    ).toThrowError(
      expect.objectContaining({
        name: 'IntegerOutOfRangeError',
        message: `Number "-170141183460469231731687303715884105729n" is not in safe 128-bit signed integer range (-170141183460469231731687303715884105728n to 170141183460469231731687303715884105727n)

Version: @tronweb3/tviem@${version}`,
      }),
    )
  })
})

describe('converts boolean to hex', () => {
  test('default', () => {
    expect(toHex(true)).toMatchInlineSnapshot('"0x1"')
    expect(toHex(false)).toMatchInlineSnapshot('"0x0"')

    expect(boolToHex(true)).toMatchInlineSnapshot('"0x1"')
    expect(boolToHex(false)).toMatchInlineSnapshot('"0x0"')
  })

  test('args: size', () => {
    expect(toHex(true, { size: 16 })).toMatchInlineSnapshot(
      '"0x00000000000000000000000000000001"',
    )
    expect(toHex(true, { size: 32 })).toMatchInlineSnapshot(
      '"0x0000000000000000000000000000000000000000000000000000000000000001"',
    )
    expect(boolToHex(false, { size: 16 })).toMatchInlineSnapshot(
      '"0x00000000000000000000000000000000"',
    )
    expect(boolToHex(false, { size: 32 })).toMatchInlineSnapshot(
      '"0x0000000000000000000000000000000000000000000000000000000000000000"',
    )
  })

  test('error: size overflow', () => {
    expect(() => toHex(true, { size: 0 })).toThrowError(
      expect.objectContaining({
        name: 'SizeOverflowError',
        message: `Size cannot exceed 0 bytes. Given size: 1 bytes.

Version: @tronweb3/tviem@${version}`,
      }),
    )
    expect(() => boolToHex(false, { size: 0 })).toThrowError(
      expect.objectContaining({
        name: 'SizeOverflowError',
        message: `Size cannot exceed 0 bytes. Given size: 1 bytes.

Version: @tronweb3/tviem@${version}`,
      }),
    )
  })
})

describe('converts string to hex', () => {
  test('default', () => {
    expect(toHex('')).toMatchInlineSnapshot('"0x"')
    expect(toHex('a')).toMatchInlineSnapshot('"0x61"')
    expect(toHex('abc')).toMatchInlineSnapshot('"0x616263"')
    expect(toHex('Hello World!')).toMatchInlineSnapshot(
      '"0x48656c6c6f20576f726c6421"',
    )

    expect(stringToHex('')).toMatchInlineSnapshot('"0x"')
    expect(stringToHex('a')).toMatchInlineSnapshot('"0x61"')
    expect(stringToHex('abc')).toMatchInlineSnapshot('"0x616263"')
    expect(stringToHex('Hello World!')).toMatchInlineSnapshot(
      '"0x48656c6c6f20576f726c6421"',
    )
  })

  test('args: size', () => {
    expect(toHex('Hello World!', { size: 16 })).toMatchInlineSnapshot(
      '"0x48656c6c6f20576f726c642100000000"',
    )
    expect(toHex('Hello World!', { size: 32 })).toMatchInlineSnapshot(
      '"0x48656c6c6f20576f726c64210000000000000000000000000000000000000000"',
    )
    expect(stringToHex('Hello World!', { size: 16 })).toMatchInlineSnapshot(
      '"0x48656c6c6f20576f726c642100000000"',
    )
    expect(stringToHex('Hello World!', { size: 32 })).toMatchInlineSnapshot(
      '"0x48656c6c6f20576f726c64210000000000000000000000000000000000000000"',
    )
  })

  test('error: size overflow', () => {
    expect(() => toHex('Hello World!', { size: 8 })).toThrowError(
      expect.objectContaining({
        name: 'SizeOverflowError',
        message: `Size cannot exceed 8 bytes. Given size: 12 bytes.

Version: @tronweb3/tviem@${version}`,
      }),
    )
    expect(() => stringToHex('Hello World!', { size: 8 })).toThrowError(
      expect.objectContaining({
        name: 'SizeOverflowError',
        message: `Size cannot exceed 8 bytes. Given size: 12 bytes.

Version: @tronweb3/tviem@${version}`,
      }),
    )
  })
})

describe('converts bytes to hex', () => {
  test('default', () => {
    expect(toHex(new Uint8Array([]))).toMatchInlineSnapshot('"0x"')
    expect(toHex(new Uint8Array([97]))).toMatchInlineSnapshot('"0x61"')
    expect(toHex(new Uint8Array([97, 98, 99]))).toMatchInlineSnapshot(
      '"0x616263"',
    )
    expect(
      toHex(
        new Uint8Array([
          72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33,
        ]),
      ),
    ).toMatchInlineSnapshot('"0x48656c6c6f20576f726c6421"')

    expect(bytesToHex(new Uint8Array([]))).toMatchInlineSnapshot('"0x"')
    expect(bytesToHex(new Uint8Array([97]))).toMatchInlineSnapshot('"0x61"')
    expect(bytesToHex(new Uint8Array([97, 98, 99]))).toMatchInlineSnapshot(
      '"0x616263"',
    )
    expect(
      bytesToHex(
        new Uint8Array([
          72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33,
        ]),
      ),
    ).toMatchInlineSnapshot('"0x48656c6c6f20576f726c6421"')
  })

  test('args: size', () => {
    expect(
      toHex(
        new Uint8Array([
          72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33,
        ]),
        { size: 16 },
      ),
    ).toMatchInlineSnapshot('"0x48656c6c6f20576f726c642100000000"')
    expect(
      bytesToHex(
        new Uint8Array([
          72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33,
        ]),
        { size: 16 },
      ),
    ).toMatchInlineSnapshot('"0x48656c6c6f20576f726c642100000000"')
    expect(
      toHex(
        new Uint8Array([
          72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33,
        ]),
        { size: 32 },
      ),
    ).toMatchInlineSnapshot(
      '"0x48656c6c6f20576f726c64210000000000000000000000000000000000000000"',
    )
    expect(
      bytesToHex(
        new Uint8Array([
          72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33,
        ]),
        { size: 32 },
      ),
    ).toMatchInlineSnapshot(
      '"0x48656c6c6f20576f726c64210000000000000000000000000000000000000000"',
    )
  })

  test('error: size overflow', () => {
    expect(() =>
      toHex(
        new Uint8Array([
          72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33,
        ]),
        { size: 8 },
      ),
    ).toThrowError(
      expect.objectContaining({
        name: 'SizeOverflowError',
        message: `Size cannot exceed 8 bytes. Given size: 12 bytes.

Version: @tronweb3/tviem@${version}`,
      }),
    )
    expect(() =>
      bytesToHex(
        new Uint8Array([
          72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33,
        ]),
        { size: 8 },
      ),
    ).toThrowError(
      expect.objectContaining({
        name: 'SizeOverflowError',
        message: `Size cannot exceed 8 bytes. Given size: 12 bytes.

Version: @tronweb3/tviem@${version}`,
      }),
    )
  })
})

test('@tronweb3/tviem: numberToHex(1000000n, { size: 32 })', () => {
  expect(numberToHex(1000000n, { size: 32 })).toBe(
    '0x00000000000000000000000000000000000000000000000000000000000f4240',
  )
})

test('@tronweb3/tviem: max uint256 boundary', () => {
  // 2**256 - 1 encodes to exactly 64 "f" nibbles
  expect(numberToHex(2n ** 256n - 1n, { size: 32 })).toBe(
    '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  )
  expect(() => numberToHex(2n ** 256n, { size: 32 })).toThrowError(
    expect.objectContaining({
      name: 'IntegerOutOfRangeError',
      message: `Number "115792089237316195423570985008687907853269984665640564039457584007913129639936n" is not in safe 256-bit unsigned integer range (0n to 115792089237316195423570985008687907853269984665640564039457584007913129639935n)

Version: @tronweb3/tviem@${version}`,
    }),
  )
})

test('@tronweb3/tviem: int256 extremes', () => {
  expect(numberToHex(-(2n ** 255n), { size: 32, signed: true })).toBe(
    '0x8000000000000000000000000000000000000000000000000000000000000000',
  )
  expect(numberToHex(2n ** 255n - 1n, { size: 32, signed: true })).toBe(
    '0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  )
  expect(() =>
    numberToHex(2n ** 255n, { size: 32, signed: true }),
  ).toThrowError(
    expect.objectContaining({
      name: 'IntegerOutOfRangeError',
      message: `Number "57896044618658097711785492504343953926634992332820282019728792003956564819968n" is not in safe 256-bit signed integer range (-57896044618658097711785492504343953926634992332820282019728792003956564819968n to 57896044618658097711785492504343953926634992332820282019728792003956564819967n)

Version: @tronweb3/tviem@${version}`,
    }),
  )
})
