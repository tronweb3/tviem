import { expect, test } from 'vitest'
import { PositionOutOfBoundsError } from '../../../../src/errors/cursor.js'
import {
  IntegerOutOfRangeError,
  UnsupportedWireTypeError,
} from '../../../../src/errors/encoding.js'
import { version } from '../../../../src/errors/version.js'
import type { ByteArray } from '../../../../src/types/misc.js'
import { concatBytes } from '../../../../src/utils/data/concat.js'
import { bytesToString } from '../../../../src/utils/encoding/fromBytes.js'
import { hexToBytes } from '../../../../src/utils/encoding/toBytes.js'
import { bytesToHex } from '../../../../src/utils/encoding/toHex.js'
import {
  type ProtoField,
  readFields,
  readMessageFields,
} from '../../../../src/utils/transaction/protobuf/reader.js'
import { writeUvarint } from '../../../../src/utils/transaction/protobuf/varint.js'
import {
  fBytes,
  fInt,
  tag,
} from '../../../../src/utils/transaction/protobuf/writer.js'

/** Extracts the byte payload of a non-varint field, narrowing the union. */
function lenValue(field: ProtoField | undefined): ByteArray {
  if (!field || field.wireType === 0)
    throw new Error('expected a length-delimited field')
  return field.value
}

test('readMessageFields', () => {
  expect(readMessageFields(new Uint8Array([]))).toStrictEqual([])
  expect(readMessageFields(new Uint8Array([0x08, 0x96, 0x01]))).toStrictEqual([
    { fieldNo: 1, wireType: 0, value: 150n },
  ])
  // Empty LEN payload decodes to empty bytes.
  expect(readMessageFields(new Uint8Array([0x0a, 0x00]))).toStrictEqual([
    { fieldNo: 1, wireType: 2, value: new Uint8Array([]) },
  ])
  // Repeated fields appear once per occurrence.
  expect(
    readMessageFields(
      concatBytes([
        fBytes(2, new Uint8Array([0x01])),
        fBytes(2, new Uint8Array([0x02])),
      ]),
    ),
  ).toStrictEqual([
    { fieldNo: 2, wireType: 2, value: new Uint8Array([0x01]) },
    { fieldNo: 2, wireType: 2, value: new Uint8Array([0x02]) },
  ])
})

test('decodes the §2.3 raw_data fixture (three nested layers)', () => {
  const raw = hexToBytes(
    '0x0a0212342208010203040506070840e0a499ffbc315a67080112630a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412320a15417e5f4552091a69125d5dfcb7b8c2659029395bdf121541928c9af0651632157ef27a2cf17ca72c575a4d2118c0843d7080d095ffbc31',
  )

  // Transaction.raw
  const fields = readMessageFields(raw)
  expect(fields.length).toBe(5)
  expect(fields[0]).toStrictEqual({
    fieldNo: 1,
    wireType: 2,
    value: hexToBytes('0x1234'),
  })
  expect(fields[1]).toStrictEqual({
    fieldNo: 4,
    wireType: 2,
    value: hexToBytes('0x0102030405060708'),
  })
  expect(fields[2]).toStrictEqual({
    fieldNo: 8,
    wireType: 0,
    value: 1_700_000_060_000n,
  })
  expect(fields[3]).toMatchObject({ fieldNo: 11, wireType: 2 })
  expect(fields[4]).toStrictEqual({
    fieldNo: 14,
    wireType: 0,
    value: 1_700_000_000_000n,
  })

  // Transaction.Contract
  const contract = readMessageFields(lenValue(fields[3]))
  expect(contract[0]).toStrictEqual({ fieldNo: 1, wireType: 0, value: 1n })

  // google.protobuf.Any
  const any = readMessageFields(lenValue(contract[1]))
  expect(bytesToString(lenValue(any[0]))).toBe(
    'type.googleapis.com/protocol.TransferContract',
  )

  // TransferContract
  const inner = readMessageFields(lenValue(any[1]))
  expect(bytesToHex(lenValue(inner[0]))).toBe(
    '0x417e5f4552091a69125d5dfcb7b8c2659029395bdf',
  )
  expect(bytesToHex(lenValue(inner[1]))).toBe(
    '0x41928c9af0651632157ef27a2cf17ca72c575a4d21',
  )
  expect(inner[2]).toStrictEqual({ fieldNo: 3, wireType: 0, value: 1_000_000n })
})

test('tolerates wire types 1 and 5 (raw 8/4-byte payload)', () => {
  const bytes = concatBytes([
    tag(1, 1),
    hexToBytes('0x0102030405060708'),
    tag(2, 5),
    hexToBytes('0x0a0b0c0d'),
    fInt(3, 7n),
  ])
  expect(readMessageFields(bytes)).toStrictEqual([
    { fieldNo: 1, wireType: 1, value: hexToBytes('0x0102030405060708') },
    { fieldNo: 2, wireType: 5, value: hexToBytes('0x0a0b0c0d') },
    { fieldNo: 3, wireType: 0, value: 7n },
  ])
})

test('throws on unsupported wire types', () => {
  // key = field 1 with wire type 3 (SGROUP) / 4 (EGROUP) / 6 / 7.
  for (const key of [0x0b, 0x0c, 0x0e, 0x0f])
    expect(() => readMessageFields(new Uint8Array([key]))).toThrow(
      UnsupportedWireTypeError,
    )
  expect(() => readMessageFields(new Uint8Array([0x0b]))).toThrowError(
    expect.objectContaining({
      name: 'UnsupportedWireTypeError',
      message: `Wire type \`3\` is not supported.

Version: @tronweb3/tviem@${version}`,
    }),
  )
})

test('throws on invalid field numbers', () => {
  // Field number 0 (any wire type) is malformed.
  expect(() => readMessageFields(new Uint8Array([0x00]))).toThrow(
    IntegerOutOfRangeError,
  )
  expect(() => readMessageFields(new Uint8Array([0x02, 0x00]))).toThrow(
    IntegerOutOfRangeError,
  )
  // Field number above 2^29 - 1.
  const key = concatBytes([writeUvarint(536870912n << 3n), new Uint8Array([1])])
  expect(() => readMessageFields(key)).toThrow(IntegerOutOfRangeError)
})

test('throws on truncated data', () => {
  // Truncated key.
  expect(() => readMessageFields(new Uint8Array([0x80]))).toThrow(
    PositionOutOfBoundsError,
  )
  // Truncated varint value.
  expect(() => readMessageFields(new Uint8Array([0x08, 0x80]))).toThrow(
    PositionOutOfBoundsError,
  )
  // LEN payload shorter than its declared length.
  expect(() => readMessageFields(new Uint8Array([0x0a, 0x05, 0x01]))).toThrow(
    PositionOutOfBoundsError,
  )
  // Declared LEN length missing entirely.
  expect(() => readMessageFields(new Uint8Array([0x0a]))).toThrow(
    PositionOutOfBoundsError,
  )
  // Declared LEN length larger than the address space.
  const huge = concatBytes([
    tag(1, 2),
    writeUvarint(9223372036854775807n),
    new Uint8Array([0x01]),
  ])
  expect(() => readMessageFields(huge)).toThrow(PositionOutOfBoundsError)
  // Truncated fixed64/fixed32 payloads.
  expect(() =>
    readMessageFields(concatBytes([tag(1, 1), hexToBytes('0x0102')])),
  ).toThrow(PositionOutOfBoundsError)
  expect(() =>
    readMessageFields(concatBytes([tag(1, 5), hexToBytes('0x0102')])),
  ).toThrow(PositionOutOfBoundsError)
})

test('readFields is lazy', () => {
  const iterator = readFields(
    concatBytes([fInt(1, 5n), new Uint8Array([0x0b])]),
  )
  expect(iterator.next().value).toStrictEqual({
    fieldNo: 1,
    wireType: 0,
    value: 5n,
  })
  expect(() => iterator.next()).toThrow(UnsupportedWireTypeError)
})
