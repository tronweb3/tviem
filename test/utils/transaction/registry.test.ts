import { expect, test } from 'vitest'

import { hexToBytes } from '../../../src/utils/encoding/toBytes.js'
import { bytesToHex } from '../../../src/utils/encoding/toHex.js'
import {
  ContractType,
  contractCodecs,
  contractTypeUrlPrefix,
  decodeContractParameter,
  getContractCodecByType,
  getContractCodecByTypeUrl,
} from '../../../src/utils/transaction/registry.js'

// §2.1 V1, §2.3 `to`.
const v1 = '417e5f4552091a69125d5dfcb7b8c2659029395bdf' as const
const to = '41928c9af0651632157ef27a2cf17ca72c575a4d21' as const

test('ContractType: §6 integers', () => {
  expect(ContractType).toStrictEqual({
    TransferContract: 1,
    TransferAssetContract: 2,
    VoteWitnessContract: 4,
    WithdrawBalanceContract: 13,
    CreateSmartContract: 30,
    TriggerSmartContract: 31,
    AccountPermissionUpdateContract: 46,
    FreezeBalanceV2Contract: 54,
    UnfreezeBalanceV2Contract: 55,
    WithdrawExpireUnfreezeContract: 56,
    DelegateResourceContract: 57,
    UnDelegateResourceContract: 58,
    CancelAllUnfreezeV2Contract: 59,
  })
})

test('bidirectional lookup: typeUrl ↔ codec ↔ type integer', () => {
  expect(contractCodecs).toHaveLength(13)
  for (const [name, type] of Object.entries(ContractType)) {
    const typeUrl = `${contractTypeUrlPrefix}${name}`
    const codec = getContractCodecByTypeUrl(typeUrl)
    expect(codec).toBeDefined()
    expect(codec!.name).toBe(name)
    expect(codec!.type).toBe(type)
    expect(codec!.typeUrl).toBe(typeUrl)
    expect(getContractCodecByType(type)).toBe(codec)
  }
})

test('unregistered lookups return undefined', () => {
  expect(
    getContractCodecByTypeUrl(
      'type.googleapis.com/protocol.AccountCreateContract',
    ),
  ).toBeUndefined()
  expect(getContractCodecByType(0)).toBeUndefined()
  expect(getContractCodecByType(3)).toBeUndefined()
})

test('decodeContractParameter: registered type URL decodes the message', () => {
  const value = hexToBytes(`0x0a15${v1}1215${to}18c0843d`)
  expect(
    decodeContractParameter(
      'type.googleapis.com/protocol.TransferContract',
      value,
    ),
  ).toStrictEqual({ ownerAddress: v1, toAddress: to, amount: 1_000_000n })
})

test('decodeContractParameter: unknown type URL falls back to __unknown (no throw)', () => {
  const valueBytes = new Uint8Array([1, 2, 3])
  const decoded = decodeContractParameter(
    'type.googleapis.com/protocol.FooBarContract',
    valueBytes,
  )
  expect(decoded).toStrictEqual({
    __unknown: true,
    typeUrl: 'type.googleapis.com/protocol.FooBarContract',
    valueBytes: new Uint8Array([1, 2, 3]),
  })
})

test('registry codec encode/decode round-trips (§2.3 Any-value bytes)', () => {
  const codec = getContractCodecByType(ContractType.TransferContract)!
  const x = { ownerAddress: v1, toAddress: to, amount: 1_000_000n }
  expect(bytesToHex(codec.encode(x))).toBe(`0x0a15${v1}1215${to}18c0843d`)
  expect(codec.decode(codec.encode(x))).toStrictEqual(x)
})
