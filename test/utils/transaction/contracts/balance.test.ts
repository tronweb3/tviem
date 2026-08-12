import { expect, test } from 'vitest'

import { bytesToHex } from '../../../../src/utils/encoding/toHex.js'
import {
  decodeCancelAllUnfreezeV2Contract,
  decodeFreezeBalanceV2Contract,
  decodeUnfreezeBalanceV2Contract,
  decodeWithdrawBalanceContract,
  decodeWithdrawExpireUnfreezeContract,
  encodeCancelAllUnfreezeV2Contract,
  encodeFreezeBalanceV2Contract,
  encodeUnfreezeBalanceV2Contract,
  encodeWithdrawBalanceContract,
  encodeWithdrawExpireUnfreezeContract,
} from '../../../../src/utils/transaction/contracts/balance.js'
import type {
  CancelAllUnfreezeV2Contract,
  FreezeBalanceV2Contract,
  UnfreezeBalanceV2Contract,
} from '../../../../src/utils/transaction/types.js'
import { ResourceCode } from '../../../../src/utils/transaction/types.js'

// §2.1 V1.
const v1 = '417e5f4552091a69125d5dfcb7b8c2659029395bdf' as const

test('owner-only contracts encode to a single address field', () => {
  expect(bytesToHex(encodeWithdrawBalanceContract({ owner_address: v1 }))).toBe(
    `0x0a15${v1}`,
  )
  expect(
    bytesToHex(encodeWithdrawExpireUnfreezeContract({ owner_address: v1 })),
  ).toBe(`0x0a15${v1}`)
  expect(
    bytesToHex(encodeCancelAllUnfreezeV2Contract({ owner_address: v1 })),
  ).toBe(`0x0a15${v1}`)
})

test('owner-only contracts round-trip', () => {
  const x = { owner_address: v1 }
  expect(
    decodeWithdrawBalanceContract(encodeWithdrawBalanceContract(x)),
  ).toStrictEqual(x)
  expect(
    decodeWithdrawExpireUnfreezeContract(
      encodeWithdrawExpireUnfreezeContract(x),
    ),
  ).toStrictEqual(x)
  const cancel: CancelAllUnfreezeV2Contract = x
  expect(
    decodeCancelAllUnfreezeV2Contract(
      encodeCancelAllUnfreezeV2Contract(cancel),
    ),
  ).toStrictEqual(cancel)
})

test('encodeFreezeBalanceV2Contract', () => {
  const encoded = encodeFreezeBalanceV2Contract({
    owner_address: v1,
    frozen_balance: 1_000_000n,
    resource: ResourceCode.ENERGY,
  })
  expect(bytesToHex(encoded)).toBe(`0x0a15${v1}10c0843d1801`)
})

test('encodeFreezeBalanceV2Contract: zero enum (BANDWIDTH) is omitted', () => {
  const encoded = encodeFreezeBalanceV2Contract({
    owner_address: v1,
    frozen_balance: 1_000_000n,
    resource: ResourceCode.BANDWIDTH,
  })
  expect(bytesToHex(encoded)).toBe(`0x0a15${v1}10c0843d`)
})

test('encodeUnfreezeBalanceV2Contract', () => {
  const encoded = encodeUnfreezeBalanceV2Contract({
    owner_address: v1,
    unfreeze_balance: 1_000_000n,
    resource: ResourceCode.ENERGY,
  })
  expect(bytesToHex(encoded)).toBe(`0x0a15${v1}10c0843d1801`)
})

test('freeze/unfreeze decode to the canonical form (name enums, number int64)', () => {
  const freeze: FreezeBalanceV2Contract = {
    owner_address: v1,
    frozen_balance: 1_000_000n,
    resource: ResourceCode.ENERGY,
  }
  expect(
    decodeFreezeBalanceV2Contract(encodeFreezeBalanceV2Contract(freeze)),
  ).toStrictEqual({
    owner_address: v1,
    frozen_balance: 1_000_000,
    resource: 'ENERGY',
  })

  // BANDWIDTH is the zero enum: omitted on the wire and in the decoded JSON.
  const unfreeze: UnfreezeBalanceV2Contract = {
    owner_address: v1,
    unfreeze_balance: 1_000_000n,
    resource: ResourceCode.BANDWIDTH,
  }
  expect(
    decodeUnfreezeBalanceV2Contract(encodeUnfreezeBalanceV2Contract(unfreeze)),
  ).toStrictEqual({
    owner_address: v1,
    unfreeze_balance: 1_000_000,
  })
})
