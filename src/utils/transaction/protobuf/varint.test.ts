import { expect, test } from 'vitest'

import {
  NegativeOffsetError,
  PositionOutOfBoundsError,
} from '../../../errors/cursor.js'
import {
  IntegerOutOfRangeError,
  VarintOverflowError,
} from '../../../errors/encoding.js'
import { maxUvarint, readUvarint, writeUvarint } from './varint.js'

test('writeUvarint', () => {
  expect(writeUvarint(0n)).toStrictEqual(new Uint8Array([0x00]))
  expect(writeUvarint(1n)).toStrictEqual(new Uint8Array([0x01]))
  expect(writeUvarint(127n)).toStrictEqual(new Uint8Array([0x7f]))
  expect(writeUvarint(128n)).toStrictEqual(new Uint8Array([0x80, 0x01]))
  expect(writeUvarint(144n)).toStrictEqual(new Uint8Array([0x90, 0x01]))
  expect(writeUvarint(300n)).toStrictEqual(new Uint8Array([0xac, 0x02]))
  expect(writeUvarint(1_000_000n)).toStrictEqual(
    new Uint8Array([0xc0, 0x84, 0x3d]),
  )
  // §2.3 fixture: expiration/timestamp (int64 millis).
  expect(writeUvarint(1_700_000_060_000n)).toStrictEqual(
    new Uint8Array([0xe0, 0xa4, 0x99, 0xff, 0xbc, 0x31]),
  )
  expect(writeUvarint(1_700_000_000_000n)).toStrictEqual(
    new Uint8Array([0x80, 0xd0, 0x95, 0xff, 0xbc, 0x31]),
  )
  // 2^63 - 1 (max int64).
  expect(writeUvarint(9223372036854775807n)).toStrictEqual(
    new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f]),
  )
  // 2^64 - 1 (max uint64).
  expect(writeUvarint(maxUvarint)).toStrictEqual(
    new Uint8Array([
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01,
    ]),
  )
})

test('writeUvarint: out of range', () => {
  expect(() => writeUvarint(-1n)).toThrow(IntegerOutOfRangeError)
  expect(() => writeUvarint(maxUvarint + 1n)).toThrow(IntegerOutOfRangeError)
  expect(() => writeUvarint(-1n)).toThrowErrorMatchingInlineSnapshot(`
    [IntegerOutOfRangeError: Number "-1" is not in safe 64-bit unsigned integer range (0 to 18446744073709551615)

    Version: @tronweb3/omni@0.1.0]
  `)
})

test('readUvarint', () => {
  expect(readUvarint(new Uint8Array([0x00]))).toStrictEqual({
    size: 1,
    value: 0n,
  })
  expect(readUvarint(new Uint8Array([0x90, 0x01]))).toStrictEqual({
    size: 2,
    value: 144n,
  })
  expect(readUvarint(new Uint8Array([0xc0, 0x84, 0x3d]))).toStrictEqual({
    size: 3,
    value: 1_000_000n,
  })
  // Stops at the first byte without a continuation bit.
  expect(readUvarint(new Uint8Array([0x7f, 0xff]))).toStrictEqual({
    size: 1,
    value: 127n,
  })
  // Non-canonical (over-long) encodings are accepted.
  expect(readUvarint(new Uint8Array([0x80, 0x00]))).toStrictEqual({
    size: 2,
    value: 0n,
  })
})

test('readUvarint: offset', () => {
  expect(readUvarint(new Uint8Array([0x08, 0x90, 0x01]), 1)).toStrictEqual({
    size: 2,
    value: 144n,
  })
  expect(() => readUvarint(new Uint8Array([0x01]), 1)).toThrow(
    PositionOutOfBoundsError,
  )
  expect(() => readUvarint(new Uint8Array([0x01]), -1)).toThrow(
    NegativeOffsetError,
  )
})

test('readUvarint: round trip across the 64-bit range', () => {
  const values: bigint[] = [0n, 1n, 144n, 300n, 1_000_000n, maxUvarint]
  for (let shift = 1n; shift <= 63n; shift++)
    values.push((1n << shift) - 1n, 1n << shift)
  for (const value of values) {
    const encoded = writeUvarint(value)
    expect(readUvarint(encoded)).toStrictEqual({
      size: encoded.length,
      value,
    })
  }
})

test('readUvarint: truncated', () => {
  expect(() => readUvarint(new Uint8Array([]))).toThrow(
    PositionOutOfBoundsError,
  )
  expect(() => readUvarint(new Uint8Array([0x80]))).toThrow(
    PositionOutOfBoundsError,
  )
  expect(() =>
    readUvarint(new Uint8Array([0xff, 0xff, 0xff])),
  ).toThrowErrorMatchingInlineSnapshot(`
    [PositionOutOfBoundsError: Position \`3\` is out of bounds (\`0 < position < 3\`).

    Version: @tronweb3/omni@0.1.0]
  `)
})

test('readUvarint: overflow', () => {
  // 10th byte may only carry bit 63.
  expect(() =>
    readUvarint(
      new Uint8Array([
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x02,
      ]),
    ),
  ).toThrow(VarintOverflowError)
  // Continuation past 10 bytes.
  expect(() => readUvarint(new Uint8Array(11).fill(0x80))).toThrow(
    VarintOverflowError,
  )
  expect(() =>
    readUvarint(new Uint8Array(11).fill(0x80)),
  ).toThrowErrorMatchingInlineSnapshot(`
    [VarintOverflowError: Varint exceeds the maximum size of a 64-bit unsigned integer.

    Version: @tronweb3/omni@0.1.0]
  `)
})
