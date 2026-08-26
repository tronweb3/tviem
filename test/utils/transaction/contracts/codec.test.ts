import { expect, test } from 'vitest'

import { concatBytes } from '../../../../src/utils/data/concat.js'
import { hexToBytes } from '../../../../src/utils/encoding/toBytes.js'
import { bytesToHex } from '../../../../src/utils/encoding/toHex.js'
import {
  decodeMessage,
  encodeMessage,
  type MessageSpec,
} from '../../../../src/utils/transaction/contracts/codec.js'
import { fMessage } from '../../../../src/utils/transaction/protobuf/writer.js'

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
  // `__unknown` gets no special treatment: it is an unknown key like any other.
  expect(() => encodeMessage(spec, { amount: 1n, __unknown: [] })).toThrow(
    'Unknown contract message field "__unknown".',
  )
  // ...but undefined values are ignored.
  expect(encodeMessage(spec, { amount: 0n, memo: undefined })).toStrictEqual(
    new Uint8Array(0),
  )
})

test('decodeMessage: empty input decodes to an empty message (defaults omitted)', () => {
  const decoded = decodeMessage(spec, new Uint8Array(0))
  expect(decoded).toStrictEqual({})
})

// `required` marks fields java-tron rejects at their proto3 default. Since the
// wire cannot distinguish an absent field from a default value (zero / empty),
// both refuse to encode — a message omitting them can never be chain-valid.
const requiredSpec: MessageSpec = [
  { no: 1, name: 'owner', kind: 'address', required: true },
  { no: 2, name: 'amount', kind: 'i64', required: true },
  { no: 3, name: 'payload', kind: 'bytes', required: true },
  {
    no: 4,
    name: 'items',
    kind: 'repeated-message',
    spec: [{ no: 1, name: 'n', kind: 'i64' }],
    required: true,
  },
]
const requiredOk = {
  owner: v1,
  amount: 1n,
  payload: 'dead',
  items: [{ n: 1n }],
}

test('encodeMessage: a required field present and non-default encodes', () => {
  expect(() => encodeMessage(requiredSpec, requiredOk)).not.toThrow()
})

test.each([
  ['absent', { ...requiredOk, amount: undefined }, 'amount'],
  ['null', { ...requiredOk, amount: null }, 'amount'],
  ['zero (the proto3 default)', { ...requiredOk, amount: 0n }, 'amount'],
  ['empty bytes', { ...requiredOk, payload: '0x' }, 'payload'],
  ['an empty repeated list', { ...requiredOk, items: [] }, 'items'],
])('encodeMessage: a required field %s throws', (_label, message, name) => {
  expect(() => encodeMessage(requiredSpec, message)).toThrow(
    `Missing required field "${name}"`,
  )
})

test('decodeMessage: required is not enforced on decode (faithful reading)', () => {
  expect(decodeMessage(requiredSpec, new Uint8Array(0))).toStrictEqual({})
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

test('decodeMessage: a wire field outside the schema throws (strict)', () => {
  const bytes = concatBytes([
    encodeMessage(spec, { amount: 5n }),
    // Field 15, VARINT, value 7.
    new Uint8Array([0x78, 0x07]),
  ])
  expect(() => decodeMessage(spec, bytes)).toThrow(
    'Unknown wire field 15 (wire type 0) in contract message.',
  )
})

test('decodeMessage: wire-type mismatch on a known field throws', () => {
  // Field 3 is declared `i64` but arrives as LEN.
  expect(() => decodeMessage(spec, hexToBytes('0x1a020102'))).toThrow(
    'Unknown wire field 3 (wire type 2) in contract message.',
  )
})

test('decodeMessage: strictness propagates through nested messages', () => {
  const nestedSpec: MessageSpec = [
    { no: 1, name: 'votes', kind: 'repeated-message', spec },
  ]
  const inner = concatBytes([
    encodeMessage(spec, { amount: 5n }),
    // Field 15, VARINT — outside the nested schema.
    new Uint8Array([0x78, 0x07]),
  ])
  const outer = fMessage(1, inner, { emitDefault: true })
  expect(() => decodeMessage(nestedSpec, outer)).toThrow(
    'Unknown wire field 15 (wire type 0) in contract message.',
  )
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
