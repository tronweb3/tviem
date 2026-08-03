import { expect, test } from 'vitest'

import { bytesToHex } from '../../../../src/utils/encoding/toHex.js'
import {
  decodeDelegateResourceContract,
  decodeUnDelegateResourceContract,
  encodeDelegateResourceContract,
  encodeUnDelegateResourceContract,
} from '../../../../src/utils/transaction/contracts/resource.js'
import type {
  DelegateResourceContract,
  UnDelegateResourceContract,
} from '../../../../src/utils/transaction/types.js'
import { ResourceCode } from '../../../../src/utils/transaction/types.js'

// §2.1 V1 / V2.
const v1 = '417e5f4552091a69125d5dfcb7b8c2659029395bdf' as const
const v2 = '412b5ad5c4795c026514f8317c7a215e218dccd6cf' as const

test('encodeDelegateResourceContract: §6 field order regression', () => {
  const encoded = encodeDelegateResourceContract({
    owner_address: v1,
    resource: ResourceCode.ENERGY,
    balance: 1_000_000n,
    receiver_address: v2,
    lock: true,
    lock_period: 144n,
  })
  // owner(1) · resource(2) · balance(3) · receiver(4) · lock(5) · lock_period(6)
  expect(bytesToHex(encoded)).toBe(`0x0a15${v1}100118c0843d2215${v2}2801309001`)
})

test('encodeDelegateResourceContract: proto3 defaults omitted', () => {
  const encoded = encodeDelegateResourceContract({
    owner_address: v1,
    resource: ResourceCode.BANDWIDTH,
    balance: 1_000_000n,
    receiver_address: v2,
    lock: false,
    lock_period: 0n,
  })
  expect(bytesToHex(encoded)).toBe(`0x0a15${v1}18c0843d2215${v2}`)
})

test('encodeUnDelegateResourceContract: same field order', () => {
  const encoded = encodeUnDelegateResourceContract({
    owner_address: v1,
    resource: ResourceCode.ENERGY,
    balance: 1_000_000n,
    receiver_address: v2,
  })
  expect(bytesToHex(encoded)).toBe(`0x0a15${v1}100118c0843d2215${v2}`)
})

test('decode(encode(x)) canonicalizes to the node-JSON form', () => {
  const delegate: DelegateResourceContract = {
    owner_address: v1,
    resource: ResourceCode.ENERGY,
    balance: 1_000_000n,
    receiver_address: v2,
    lock: true,
    lock_period: 144n,
  }
  expect(
    decodeDelegateResourceContract(encodeDelegateResourceContract(delegate)),
  ).toStrictEqual({
    owner_address: v1,
    resource: 'ENERGY',
    balance: 1_000_000,
    receiver_address: v2,
    lock: true,
    lock_period: 144,
  })

  // BANDWIDTH is the zero enum — omitted from wire and canonical JSON alike.
  const undelegate: UnDelegateResourceContract = {
    owner_address: v1,
    resource: ResourceCode.BANDWIDTH,
    balance: 1_000_000n,
    receiver_address: v2,
  }
  expect(
    decodeUnDelegateResourceContract(
      encodeUnDelegateResourceContract(undelegate),
    ),
  ).toStrictEqual({
    owner_address: v1,
    balance: 1_000_000,
    receiver_address: v2,
  })
})

test('decodeDelegateResourceContract: absent fields stay absent', () => {
  const decoded = decodeDelegateResourceContract(
    encodeDelegateResourceContract({
      owner_address: v1,
      balance: 1n,
      receiver_address: v2,
    }),
  )
  expect(decoded).toStrictEqual({
    owner_address: v1,
    balance: 1,
    receiver_address: v2,
  })
})
