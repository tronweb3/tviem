import { expect, test } from 'vitest'

import { bytesToHex } from '../../encoding/toHex.js'
import type {
  DelegateResourceContract,
  UnDelegateResourceContract,
} from '../types.js'
import { ResourceCode } from '../types.js'
import {
  decodeDelegateResourceContract,
  decodeUnDelegateResourceContract,
  encodeDelegateResourceContract,
  encodeUnDelegateResourceContract,
} from './resource.js'

// §2.1 V1 / V2.
const v1 = '417e5f4552091a69125d5dfcb7b8c2659029395bdf' as const
const v2 = '412b5ad5c4795c026514f8317c7a215e218dccd6cf' as const

test('encodeDelegateResourceContract: §6 field order regression', () => {
  const encoded = encodeDelegateResourceContract({
    ownerAddress: v1,
    resource: ResourceCode.ENERGY,
    balance: 1_000_000n,
    receiverAddress: v2,
    lock: true,
    lockPeriod: 144n,
  })
  // owner(1) · resource(2) · balance(3) · receiver(4) · lock(5) · lock_period(6)
  expect(bytesToHex(encoded)).toBe(`0x0a15${v1}100118c0843d2215${v2}2801309001`)
})

test('encodeDelegateResourceContract: proto3 defaults omitted', () => {
  const encoded = encodeDelegateResourceContract({
    ownerAddress: v1,
    resource: ResourceCode.BANDWIDTH,
    balance: 1_000_000n,
    receiverAddress: v2,
    lock: false,
    lockPeriod: 0n,
  })
  expect(bytesToHex(encoded)).toBe(`0x0a15${v1}18c0843d2215${v2}`)
})

test('encodeUnDelegateResourceContract: same field order', () => {
  const encoded = encodeUnDelegateResourceContract({
    ownerAddress: v1,
    resource: ResourceCode.ENERGY,
    balance: 1_000_000n,
    receiverAddress: v2,
  })
  expect(bytesToHex(encoded)).toBe(`0x0a15${v1}100118c0843d2215${v2}`)
})

test('decode(encode(x)) round-trips', () => {
  const delegate: DelegateResourceContract = {
    ownerAddress: v1,
    resource: ResourceCode.ENERGY,
    balance: 1_000_000n,
    receiverAddress: v2,
    lock: true,
    lockPeriod: 144n,
  }
  expect(
    decodeDelegateResourceContract(encodeDelegateResourceContract(delegate)),
  ).toStrictEqual(delegate)

  const undelegate: UnDelegateResourceContract = {
    ownerAddress: v1,
    resource: ResourceCode.BANDWIDTH,
    balance: 1_000_000n,
    receiverAddress: v2,
  }
  expect(
    decodeUnDelegateResourceContract(
      encodeUnDelegateResourceContract(undelegate),
    ),
  ).toStrictEqual(undelegate)
})

test('decodeDelegateResourceContract: defaults fill on partial input', () => {
  const decoded = decodeDelegateResourceContract(
    encodeDelegateResourceContract({
      ownerAddress: v1,
      balance: 1n,
      receiverAddress: v2,
    }),
  )
  expect(decoded).toStrictEqual({
    ownerAddress: v1,
    resource: 0,
    balance: 1n,
    receiverAddress: v2,
    lock: false,
    lockPeriod: 0n,
  })
})
