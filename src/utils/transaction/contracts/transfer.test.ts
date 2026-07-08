import { expect, test } from 'vitest'

import { concatBytes } from '../../data/concat.js'
import { hexToBytes } from '../../encoding/toBytes.js'
import { bytesToHex } from '../../encoding/toHex.js'
import type { TransferAssetContract, TransferContract } from '../types.js'
import {
  decodeTransferAssetContract,
  decodeTransferContract,
  encodeTransferAssetContract,
  encodeTransferContract,
} from './transfer.js'

// §2.1 V1 / V2, §2.3 `to`.
const v1 = '417e5f4552091a69125d5dfcb7b8c2659029395bdf' as const
const v2 = '412b5ad5c4795c026514f8317c7a215e218dccd6cf' as const
const to = '41928c9af0651632157ef27a2cf17ca72c575a4d21' as const

test('encodeTransferContract: §2.3 acceptance bytes', () => {
  const encoded = encodeTransferContract({
    ownerAddress: v1,
    toAddress: 'TPL66VK2gCXNCD7EJg9pgJRfqcRazjhUZY',
    amount: 1_000_000n,
  })
  // `0a15<owner21> 1215<to21> 18c0843d` — the Any-value of the §2.3 fixture.
  expect(bytesToHex(encoded)).toBe(`0x0a15${v1}1215${to}18c0843d`)
})

test('encodeTransferContract: every owner address form encodes identically', () => {
  const expected = `0x0a15${v1}1215${to}18c0843d`
  const message = { toAddress: to, amount: 1_000_000n }
  expect(
    bytesToHex(
      encodeTransferContract({
        ...message,
        ownerAddress: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC',
      }),
    ),
  ).toBe(expected)
  expect(
    bytesToHex(encodeTransferContract({ ...message, ownerAddress: v1 })),
  ).toBe(expected)
  expect(
    bytesToHex(
      encodeTransferContract({
        ...message,
        ownerAddress: '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf',
      }),
    ),
  ).toBe(expected)
  expect(
    bytesToHex(
      encodeTransferContract({
        ...message,
        ownerAddress: hexToBytes(`0x${v1}`),
      }),
    ),
  ).toBe(expected)
})

test('encodeTransferContract: zero amount is omitted (proto3 default)', () => {
  const encoded = encodeTransferContract({
    ownerAddress: v1,
    toAddress: to,
    amount: 0n,
  })
  expect(bytesToHex(encoded)).toBe(`0x0a15${v1}1215${to}`)
})

test('decode(encode(x)) round-trips', () => {
  const x: TransferContract = {
    ownerAddress: v1,
    toAddress: to,
    amount: 1_000_000n,
  }
  expect(decodeTransferContract(encodeTransferContract(x))).toStrictEqual(x)

  const zero: TransferContract = { ownerAddress: v1, toAddress: to, amount: 0n }
  expect(decodeTransferContract(encodeTransferContract(zero))).toStrictEqual(
    zero,
  )
})

test('decodeTransferContract: unknown fields land in __unknown', () => {
  const bytes = concatBytes([
    encodeTransferContract({ ownerAddress: v1, toAddress: to, amount: 1n }),
    // Field 15, VARINT, value 7 — not part of the schema.
    new Uint8Array([0x78, 0x07]),
  ])
  expect(decodeTransferContract(bytes)).toStrictEqual({
    ownerAddress: v1,
    toAddress: to,
    amount: 1n,
    __unknown: [{ fieldNo: 15, wireType: 0, value: 7n }],
  })
})

test('encodeTransferAssetContract: asset_name is field 1', () => {
  const expected = `0x0a07313030303030311215${v1}1a15${v2}2005`
  // UTF-8 and hex forms of the same TRC10 asset id encode identically.
  expect(
    bytesToHex(
      encodeTransferAssetContract({
        assetName: '1000001',
        ownerAddress: v1,
        toAddress: v2,
        amount: 5n,
      }),
    ),
  ).toBe(expected)
  expect(
    bytesToHex(
      encodeTransferAssetContract({
        assetName: '0x31303030303031',
        ownerAddress: v1,
        toAddress: v2,
        amount: 5n,
      }),
    ),
  ).toBe(expected)
})

test('decode(encode(x)) round-trips (TransferAssetContract)', () => {
  const x: TransferAssetContract = {
    assetName: '0x31303030303031',
    ownerAddress: v1,
    toAddress: v2,
    amount: 5n,
  }
  expect(
    decodeTransferAssetContract(encodeTransferAssetContract(x)),
  ).toStrictEqual(x)
})
