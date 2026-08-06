import { expect, test } from 'vitest'

import { UnknownContractTypeError } from '../../../src/errors/transaction.js'
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
    AccountCreateContract: 0,
    TransferContract: 1,
    TransferAssetContract: 2,
    VoteWitnessContract: 4,
    WitnessCreateContract: 5,
    AssetIssueContract: 6,
    WitnessUpdateContract: 8,
    ParticipateAssetIssueContract: 9,
    ProposalCreateContract: 16,
    ProposalApproveContract: 17,
    ProposalDeleteContract: 18,
    ExchangeCreateContract: 41,
    ExchangeInjectContract: 42,
    ExchangeWithdrawContract: 43,
    ExchangeTransactionContract: 44,
    AccountUpdateContract: 10,
    FreezeBalanceContract: 11,
    UnfreezeBalanceContract: 12,
    WithdrawBalanceContract: 13,
    UpdateAssetContract: 15,
    SetAccountIdContract: 19,
    CreateSmartContract: 30,
    TriggerSmartContract: 31,
    UpdateSettingContract: 33,
    UpdateEnergyLimitContract: 45,
    AccountPermissionUpdateContract: 46,
    ClearABIContract: 48,
    UpdateBrokerageContract: 49,
    FreezeBalanceV2Contract: 54,
    UnfreezeBalanceV2Contract: 55,
    WithdrawExpireUnfreezeContract: 56,
    DelegateResourceContract: 57,
    UnDelegateResourceContract: 58,
    CancelAllUnfreezeV2Contract: 59,
  })
})

test('bidirectional lookup: typeUrl ↔ codec ↔ type integer', () => {
  expect(contractCodecs).toHaveLength(34)
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
    getContractCodecByTypeUrl('type.googleapis.com/protocol.VoteAssetContract'),
  ).toBeUndefined()
  expect(getContractCodecByType(3)).toBeUndefined()
  expect(getContractCodecByType(99)).toBeUndefined()
})

test('decodeContractParameter: registered type URL decodes the message', () => {
  const value = hexToBytes(`0x0a15${v1}1215${to}18c0843d`)
  expect(
    decodeContractParameter(
      'type.googleapis.com/protocol.TransferContract',
      value,
    ),
  ).toStrictEqual({ owner_address: v1, to_address: to, amount: 1_000_000 })
})

test('decodeContractParameter: unknown type URL throws (strict)', () => {
  const valueBytes = new Uint8Array([1, 2, 3])
  let error: unknown
  try {
    decodeContractParameter(
      'type.googleapis.com/protocol.FooBarContract',
      valueBytes,
    )
  } catch (caught) {
    error = caught
  }
  expect(error).toBeInstanceOf(UnknownContractTypeError)
  const typed = error as UnknownContractTypeError
  expect(typed.shortMessage).toBe(
    'Contract type "type.googleapis.com/protocol.FooBarContract" is not supported.',
  )
  expect(typed.type).toBe('type.googleapis.com/protocol.FooBarContract')
  // The raw Any.value payload survives on the error (bare hex).
  expect(typed.value).toBe('010203')
})

test('registry codec encode/decode round-trips (§2.3 Any-value bytes)', () => {
  const codec = getContractCodecByType(ContractType.TransferContract)!
  const x = { owner_address: v1, to_address: to, amount: 1_000_000n }
  expect(bytesToHex(codec.encode(x))).toBe(`0x0a15${v1}1215${to}18c0843d`)
  // decode canonicalizes: int64 becomes its JSON-number form.
  expect(codec.decode(codec.encode(x))).toStrictEqual({
    owner_address: v1,
    to_address: to,
    amount: 1_000_000,
  })
})
