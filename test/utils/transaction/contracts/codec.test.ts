import { expect, test } from 'vitest'

import { concatBytes } from '../../../../src/utils/data/concat.js'
import { hexToBytes } from '../../../../src/utils/encoding/toBytes.js'
import { bytesToHex } from '../../../../src/utils/encoding/toHex.js'
import {
  decodeMessage,
  encodeMessage,
  type MessageSpec,
} from '../../../../src/utils/transaction/contracts/codec.js'

// §2.1 V1.
const v1 = '417e5f4552091a69125d5dfcb7b8c2659029395bdf' as const

// Synthetic schema exercising every scalar kind.
const spec: MessageSpec = [
  { no: 1, name: 'owner', kind: 'address' },
  { no: 2, name: 'note', kind: 'string' },
  { no: 3, name: 'amount', kind: 'i64' },
  { no: 4, name: 'flag', kind: 'bool' },
  { no: 5, name: 'payload', kind: 'bytes' },
  { no: 6, name: 'mode', kind: 'enum', names: ['OFF', 'SLOW', 'FAST'] },
  { no: 7, name: 'count', kind: 'i32' },
]

test('encodeMessage: proto3 defaults and undefined are omitted', () => {
  expect(
    encodeMessage(spec, {
      amount: 0n,
      count: 0,
      flag: false,
      mode: 0,
      note: '',
      payload: '0x',
    }),
  ).toStrictEqual(new Uint8Array(0))
  expect(encodeMessage(spec, {})).toStrictEqual(new Uint8Array(0))
  // The enum default by NAME is a default too.
  expect(encodeMessage(spec, { mode: 'OFF' })).toStrictEqual(new Uint8Array(0))
})

test('encodeMessage: fields are written in ascending field-number order', () => {
  const encoded = encodeMessage(spec, {
    // Deliberately out of order.
    count: 3,
    mode: 2,
    payload: '0xdead',
    flag: true,
    amount: 1n,
    note: 'hi',
    owner: v1,
  })
  expect(bytesToHex(encoded)).toBe(
    `0x0a15${v1}12026869180120012a02dead30023803`,
  )
})

test('encodeMessage: int64 and enum accept their canonical JSON forms', () => {
  // amount as number / decimal string, enum by name — same bytes as above.
  const byName = encodeMessage(spec, {
    count: 3,
    mode: 'FAST',
    payload: 'dead',
    flag: true,
    amount: '1',
    note: 'hi',
    owner: v1,
  })
  expect(bytesToHex(byName)).toBe(`0x0a15${v1}12026869180120012a02dead30023803`)
})

test('encodeMessage: an unknown enum name throws', () => {
  expect(() => encodeMessage(spec, { mode: 'TURBO' })).toThrow(
    'Unknown mode enum name "TURBO".',
  )
})

test('encodeMessage: a field outside the schema throws (strict)', () => {
  expect(() => encodeMessage(spec, { amount: 1n, memo: 'claim' })).toThrow(
    'Unknown contract message field "memo".',
  )
  // ...but undefined values and the decode-side __unknown mixin are ignored.
  expect(
    encodeMessage(spec, { amount: 0n, memo: undefined, __unknown: [] }),
  ).toStrictEqual(new Uint8Array(0))
})

test('decodeMessage: empty input decodes to an empty message (defaults omitted)', () => {
  const decoded = decodeMessage(spec, new Uint8Array(0))
  expect(decoded).toStrictEqual({})
})

test('decodeMessage: canonical output — number int64, name enum, bare-hex bytes', () => {
  const encoded = encodeMessage(spec, {
    count: 3,
    mode: 2,
    payload: '0xdead',
    flag: true,
    amount: 1n,
    note: 'hi',
    owner: v1,
  })
  expect(decodeMessage(spec, encoded)).toStrictEqual({
    owner: v1,
    note: 'hi',
    amount: 1,
    flag: true,
    payload: 'dead',
    mode: 'FAST',
    count: 3,
  })
})

test('decodeMessage: int64 past 2^53 decodes to a decimal string', () => {
  const encoded = encodeMessage(spec, { amount: 9007199254740993n })
  expect(decodeMessage(spec, encoded).amount).toBe('9007199254740993')
})

test('decodeMessage: an enum value outside the table stays numeric', () => {
  const encoded = encodeMessage(spec, { mode: 9 })
  expect(decodeMessage(spec, encoded).mode).toBe(9)
})

test('decodeMessage: unknown fields land in __unknown (never throws)', () => {
  const bytes = concatBytes([
    encodeMessage(spec, { amount: 5n }),
    // Field 15, VARINT, value 7.
    new Uint8Array([0x78, 0x07]),
    // Field 16, LEN, 2 bytes.
    new Uint8Array([0x82, 0x01, 0x02, 0xbe, 0xef]),
    // Field 20, I32 (fixed32).
    new Uint8Array([0xa5, 0x01, 0x01, 0x02, 0x03, 0x04]),
    // Field 21, I64 (fixed64).
    new Uint8Array([0xa9, 0x01, 1, 2, 3, 4, 5, 6, 7, 8]),
  ])
  const decoded = decodeMessage(spec, bytes)
  expect(decoded.amount).toBe(5)
  expect(decoded.__unknown).toStrictEqual([
    { fieldNo: 15, wireType: 0, value: 7n },
    { fieldNo: 16, wireType: 2, value: '0xbeef' },
    { fieldNo: 20, wireType: 5, value: '0x01020304' },
    { fieldNo: 21, wireType: 1, value: '0x0102030405060708' },
  ])
})

test('decodeMessage: wire-type mismatch on a known field goes to __unknown', () => {
  // Field 3 is declared `i64` but arrives as LEN.
  const decoded = decodeMessage(spec, hexToBytes('0x1a020102'))
  expect('amount' in decoded).toBe(false)
  expect(decoded.__unknown).toStrictEqual([
    { fieldNo: 3, wireType: 2, value: '0x0102' },
  ])
})

test('decodeMessage: duplicated non-repeated field follows last-one-wins', () => {
  const decoded = decodeMessage(spec, hexToBytes('0x18051807'))
  expect(decoded.amount).toBe(7)
})

test("negative int64 round-trips through two's-complement encoding", () => {
  const encoded = encodeMessage(spec, { amount: -3n })
  expect(bytesToHex(encoded)).toBe('0x18fdffffffffffffffff01')
  expect(decodeMessage(spec, encoded).amount).toBe(-3)
})
