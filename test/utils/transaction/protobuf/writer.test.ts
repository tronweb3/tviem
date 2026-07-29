import { expect, test } from 'vitest'

import {
  IntegerOutOfRangeError,
  UnsupportedWireTypeError,
} from '../../../../src/errors/encoding.js'
import { concatBytes } from '../../../../src/utils/data/concat.js'
import {
  hexToBytes,
  stringToBytes,
} from '../../../../src/utils/encoding/toBytes.js'
import { bytesToHex } from '../../../../src/utils/encoding/toHex.js'
import {
  fBool,
  fBytes,
  fEnum,
  fInt,
  fMessage,
  maxFieldNumber,
  tag,
  WireType,
} from '../../../../src/utils/transaction/protobuf/writer.js'

// §2.3 fixture (TransferContract, fixed TaPoS).
const owner = hexToBytes('0x417e5f4552091a69125d5dfcb7b8c2659029395bdf')
const to = hexToBytes('0x41928c9af0651632157ef27a2cf17ca72c575a4d21')
const typeUrl = 'type.googleapis.com/protocol.TransferContract'

test('tag', () => {
  expect(tag(1, 2)).toStrictEqual(new Uint8Array([0x0a]))
  expect(tag(2, 2)).toStrictEqual(new Uint8Array([0x12]))
  expect(tag(3, 0)).toStrictEqual(new Uint8Array([0x18]))
  expect(tag(11, 2)).toStrictEqual(new Uint8Array([0x5a]))
  expect(tag(18, 0)).toStrictEqual(new Uint8Array([0x90, 0x01]))
  expect(tag(1, WireType.Fixed64)).toStrictEqual(new Uint8Array([0x09]))
  expect(tag(1, WireType.Fixed32)).toStrictEqual(new Uint8Array([0x0d]))
  expect(tag(maxFieldNumber, 0)).toStrictEqual(
    new Uint8Array([0xf8, 0xff, 0xff, 0xff, 0x0f]),
  )
})

test('tag: invalid field number', () => {
  expect(() => tag(0, 2)).toThrow(IntegerOutOfRangeError)
  expect(() => tag(-1, 2)).toThrow(IntegerOutOfRangeError)
  expect(() => tag(1.5, 2)).toThrow(IntegerOutOfRangeError)
  expect(() => tag(maxFieldNumber + 1, 2)).toThrow(IntegerOutOfRangeError)
  expect(() => tag(0, 2)).toThrowErrorMatchingInlineSnapshot(`
    [IntegerOutOfRangeError: Number "0" is not in safe integer range (1 to 536870911)

    Version: @tronweb3/tviem@0.1.0]
  `)
})

test('tag: unsupported wire type', () => {
  // 3 (SGROUP) and 4 (EGROUP) are deprecated; 6/7 are invalid.
  for (const wireType of [3, 4, 6, 7, -1, 0.5])
    expect(() => tag(1, wireType)).toThrow(UnsupportedWireTypeError)
  expect(() => tag(1, 3)).toThrowErrorMatchingInlineSnapshot(`
    [UnsupportedWireTypeError: Wire type \`3\` is not supported.

    Version: @tronweb3/tviem@0.1.0]
  `)
})

test('fInt', () => {
  // proto3: zero is omitted.
  expect(fInt(3, 0n)).toStrictEqual(new Uint8Array([]))
  expect(fInt(3, 0)).toStrictEqual(new Uint8Array([]))
  // §2.3 fixture: amount(f3)=1_000_000 → `18c0843d`.
  expect(fInt(3, 1_000_000n)).toStrictEqual(
    new Uint8Array([0x18, 0xc0, 0x84, 0x3d]),
  )
  // §2.3 fixture: expiration(f8) / timestamp(f14).
  expect(bytesToHex(fInt(8, 1_700_000_060_000n))).toBe('0x40e0a499ffbc31')
  expect(bytesToHex(fInt(14, 1_700_000_000_000n))).toBe('0x7080d095ffbc31')
  // Negative int64 → 64-bit two's complement (10 bytes).
  expect(fInt(1, -1n)).toStrictEqual(
    new Uint8Array([
      0x08, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01,
    ]),
  )
})

test('fInt: out of range', () => {
  expect(() => fInt(1, 18446744073709551616n)).toThrow(IntegerOutOfRangeError)
  expect(() => fInt(1, -9223372036854775809n)).toThrow(IntegerOutOfRangeError)
  expect(() =>
    fInt(1, 18446744073709551616n),
  ).toThrowErrorMatchingInlineSnapshot(`
    [IntegerOutOfRangeError: Number "18446744073709551616" is not in safe integer range (-9223372036854775808 to 18446744073709551615)

    Version: @tronweb3/tviem@0.1.0]
  `)
})

test('fBool', () => {
  expect(fBool(5, false)).toStrictEqual(new Uint8Array([]))
  expect(fBool(1, true)).toStrictEqual(new Uint8Array([0x08, 0x01]))
  expect(fBool(5, true)).toStrictEqual(new Uint8Array([0x28, 0x01]))
})

test('fEnum', () => {
  expect(fEnum(2, 0)).toStrictEqual(new Uint8Array([]))
  expect(fEnum(2, 1)).toStrictEqual(new Uint8Array([0x10, 0x01]))
  expect(fEnum(1, 31)).toStrictEqual(new Uint8Array([0x08, 0x1f]))
})

test('fBytes', () => {
  // proto3: empty is omitted by default; callers can force it.
  expect(fBytes(1, new Uint8Array([]))).toStrictEqual(new Uint8Array([]))
  expect(fBytes(1, new Uint8Array([]), { emitDefault: true })).toStrictEqual(
    new Uint8Array([0x0a, 0x00]),
  )
  expect(bytesToHex(fBytes(1, owner))).toBe(
    '0x0a15417e5f4552091a69125d5dfcb7b8c2659029395bdf',
  )
  expect(bytesToHex(fBytes(2, to))).toBe(
    '0x121541928c9af0651632157ef27a2cf17ca72c575a4d21',
  )
  expect(bytesToHex(fBytes(1, stringToBytes(typeUrl)))).toBe(
    '0x0a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e7472616374',
  )
})

test('fMessage', () => {
  expect(fMessage(2, new Uint8Array([]))).toStrictEqual(new Uint8Array([]))
  expect(fMessage(2, new Uint8Array([]), { emitDefault: true })).toStrictEqual(
    new Uint8Array([0x12, 0x00]),
  )
  expect(fMessage(2, new Uint8Array([0x08, 0x01]))).toStrictEqual(
    new Uint8Array([0x12, 0x02, 0x08, 0x01]),
  )
})

test('reproduces the §2.3 raw_data fixture byte-for-byte', () => {
  // TransferContract { owner_address(1), to_address(2), amount(3) }
  const inner = concatBytes([
    fBytes(1, owner),
    fBytes(2, to),
    fInt(3, 1_000_000n),
  ])
  expect(bytesToHex(inner)).toBe(
    '0x0a15417e5f4552091a69125d5dfcb7b8c2659029395bdf121541928c9af0651632157ef27a2cf17ca72c575a4d2118c0843d',
  )

  // google.protobuf.Any { type_url(1), value(2) }
  const any = concatBytes([fBytes(1, stringToBytes(typeUrl)), fBytes(2, inner)])

  // Transaction.Contract { type(1)=TransferContract(1), parameter(2) }
  const contract = concatBytes([fEnum(1, 1), fMessage(2, any)])

  // Transaction.raw { ref_block_bytes(1), ref_block_hash(4), expiration(8),
  // contract(11), timestamp(14) } — fields ascending, defaults omitted.
  const raw = concatBytes([
    fBytes(1, hexToBytes('0x1234')),
    fBytes(4, hexToBytes('0x0102030405060708')),
    fInt(8, 1_700_000_060_000n),
    fMessage(11, contract),
    fInt(14, 1_700_000_000_000n),
  ])
  expect(bytesToHex(raw)).toBe(
    '0x0a0212342208010203040506070840e0a499ffbc315a67080112630a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412320a15417e5f4552091a69125d5dfcb7b8c2659029395bdf121541928c9af0651632157ef27a2cf17ca72c575a4d2118c0843d7080d095ffbc31',
  )
})
