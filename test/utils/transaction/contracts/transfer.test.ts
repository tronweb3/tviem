import { expect, test } from 'vitest'

import { concatBytes } from '../../../../src/utils/data/concat.js'
import { hexToBytes } from '../../../../src/utils/encoding/toBytes.js'
import { bytesToHex } from '../../../../src/utils/encoding/toHex.js'
import {
  decodeTransferAssetContract,
  decodeTransferContract,
  encodeTransferAssetContract,
  encodeTransferContract,
} from '../../../../src/utils/transaction/contracts/transfer.js'
import { flexToHex } from '../../../../src/utils/transaction/normalize.js'
import type {
  TransferAssetContract,
  TransferContract,
} from '../../../../src/utils/transaction/types.js'

// §2.1 V1 / V2, §2.3 `to`.
const v1 = '417e5f4552091a69125d5dfcb7b8c2659029395bdf' as const
const v2 = '412b5ad5c4795c026514f8317c7a215e218dccd6cf' as const
const to = '41928c9af0651632157ef27a2cf17ca72c575a4d21' as const

test('encodeTransferContract: §2.3 acceptance bytes', () => {
  const encoded = encodeTransferContract({
    owner_address: v1,
    to_address: 'TPL66VK2gCXNCD7EJg9pgJRfqcRazjhUZY',
    amount: 1_000_000n,
  })
  // `0a15<owner21> 1215<to21> 18c0843d` — the Any-value of the §2.3 fixture.
  expect(bytesToHex(encoded)).toBe(`0x0a15${v1}1215${to}18c0843d`)
})

test('encodeTransferContract: every owner address form encodes identically', () => {
  const expected = `0x0a15${v1}1215${to}18c0843d`
  const message = { to_address: to, amount: 1_000_000n }
  expect(
    bytesToHex(
      encodeTransferContract({
        ...message,
        owner_address: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC',
      }),
    ),
  ).toBe(expected)
  expect(
    bytesToHex(encodeTransferContract({ ...message, owner_address: v1 })),
  ).toBe(expected)
  expect(
    bytesToHex(
      encodeTransferContract({
        ...message,
        owner_address: '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf',
      }),
    ),
  ).toBe(expected)
  expect(
    bytesToHex(
      encodeTransferContract({
        ...message,
        owner_address: hexToBytes(`0x${v1}`),
      }),
    ),
  ).toBe(expected)
})

test('encodeTransferContract: zero amount is omitted (proto3 default)', () => {
  const encoded = encodeTransferContract({
    owner_address: v1,
    to_address: to,
    amount: 0n,
  })
  expect(bytesToHex(encoded)).toBe(`0x0a15${v1}1215${to}`)
})

test('decode(encode(x)) canonicalizes to the node-JSON form', () => {
  const x: TransferContract = {
    owner_address: v1,
    to_address: to,
    amount: 1_000_000n,
  }
  // int64 decodes to its canonical JSON form (a number here).
  expect(decodeTransferContract(encodeTransferContract(x))).toStrictEqual({
    owner_address: v1,
    to_address: to,
    amount: 1_000_000,
  })

  // A zero amount is a proto3 default: omitted on the wire AND in the
  // decoded JSON (java-tron's JsonFormat prints only set fields).
  const zero: TransferContract = {
    owner_address: v1,
    to_address: to,
    amount: 0n,
  }
  expect(decodeTransferContract(encodeTransferContract(zero))).toStrictEqual({
    owner_address: v1,
    to_address: to,
  })
})

test('decodeTransferContract: unknown fields land in __unknown', () => {
  const bytes = concatBytes([
    encodeTransferContract({ owner_address: v1, to_address: to, amount: 1n }),
    // Field 15, VARINT, value 7 — not part of the schema.
    new Uint8Array([0x78, 0x07]),
  ])
  expect(decodeTransferContract(bytes)).toStrictEqual({
    owner_address: v1,
    to_address: to,
    amount: 1,
    __unknown: [{ fieldNo: 15, wireType: 0, value: 7n }],
  })
})

test('encodeTransferAssetContract: asset_name is field 1 (bytes = hex)', () => {
  const expected = `0x0a07313030303030311215${v1}1a15${v2}2005`
  // asset_name is a bytes field: bare and 0x-prefixed hex encode identically
  // (the model speaks java-tron's visible:false dialect — UTF-8 text
  // convenience lives in the ACTION parameters via flexToHex).
  expect(
    bytesToHex(
      encodeTransferAssetContract({
        asset_name: flexToHex('1000001'),
        owner_address: v1,
        to_address: v2,
        amount: 5n,
      }),
    ),
  ).toBe(expected)
  expect(
    bytesToHex(
      encodeTransferAssetContract({
        asset_name: '0x31303030303031',
        owner_address: v1,
        to_address: v2,
        amount: 5n,
      }),
    ),
  ).toBe(expected)
})

test('decode(encode(x)) canonicalizes (TransferAssetContract)', () => {
  const x: TransferAssetContract = {
    asset_name: '0x31303030303031',
    owner_address: v1,
    to_address: v2,
    amount: 5n,
  }
  // Canonical form: bare-hex bytes, number int64.
  expect(
    decodeTransferAssetContract(encodeTransferAssetContract(x)),
  ).toStrictEqual({
    asset_name: '31303030303031',
    owner_address: v1,
    to_address: v2,
    amount: 5,
  })
})
