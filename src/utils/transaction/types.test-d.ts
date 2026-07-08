// Type-surface tests for the transaction contract-parameter models (Track D):
// i64 fields are `bigint`, address fields are the wide-in `ContractAddressInput`,
// and every model carries the `WithUnknownFields` decode-side mixin.
import { expectTypeOf, test } from 'vitest'

import type {
  Address,
  AddressInput,
  EvmAddress,
  TronHexAddress,
} from '../../types/address.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import type {
  ContractAddressInput,
  DelegateResourceContract,
  FreezeBalanceV2Contract,
  PermissionKey,
  ResourceCode,
  TransferContract,
  TriggerSmartContract,
  UnknownContractParameter,
  UnknownField,
  Vote,
  WithUnknownFields,
} from './types.js'

test('i64 amount/weight/balance fields are bigint', () => {
  expectTypeOf<TransferContract['amount']>().toEqualTypeOf<bigint>()
  expectTypeOf<Vote['voteCount']>().toEqualTypeOf<bigint>()
  expectTypeOf<PermissionKey['weight']>().toEqualTypeOf<bigint>()
  expectTypeOf<
    FreezeBalanceV2Contract['frozenBalance']
  >().toEqualTypeOf<bigint>()
  expectTypeOf<DelegateResourceContract['balance']>().toEqualTypeOf<bigint>()

  // optional i64 fields are `bigint | undefined` (exactOptionalPropertyTypes)
  expectTypeOf<TriggerSmartContract['callValue']>().toEqualTypeOf<
    bigint | undefined
  >()
  expectTypeOf<TriggerSmartContract['tokenId']>().toEqualTypeOf<
    bigint | undefined
  >()
  expectTypeOf<DelegateResourceContract['lockPeriod']>().toEqualTypeOf<
    bigint | undefined
  >()
})

test('ContractAddressInput is wide-in (AddressInput | ByteArray)', () => {
  expectTypeOf<ContractAddressInput>().toEqualTypeOf<AddressInput | ByteArray>()

  // every accepted form extends it: the three string forms + raw bytes
  expectTypeOf<Address>().toExtend<ContractAddressInput>()
  expectTypeOf<TronHexAddress>().toExtend<ContractAddressInput>()
  expectTypeOf<EvmAddress>().toExtend<ContractAddressInput>()
  expectTypeOf<ByteArray>().toExtend<ContractAddressInput>()
  expectTypeOf<'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'>().toExtend<ContractAddressInput>()
  expectTypeOf<'412b5ad5c4795c026514f8317c7a215e218dccd6cf'>().toExtend<ContractAddressInput>()
  expectTypeOf<'0x2b5ad5c4795c026514f8317c7a215e218dccd6cf'>().toExtend<ContractAddressInput>()

  // but not an arbitrary string
  expectTypeOf<string>().not.toExtend<ContractAddressInput>()
})

test('contract address fields accept every input form', () => {
  const base: Omit<TriggerSmartContract, 'ownerAddress'> = {
    contractAddress: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
    data: '0xa9059cbb',
  }
  // Base58, TRON hex, EVM hex, and raw bytes are all assignable.
  expectTypeOf<Address>().toExtend<TriggerSmartContract['ownerAddress']>()
  const a: TriggerSmartContract = {
    ...base,
    ownerAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  }
  const b: TriggerSmartContract = {
    ...base,
    ownerAddress: '412b5ad5c4795c026514f8317c7a215e218dccd6cf',
  }
  const c: TriggerSmartContract = {
    ...base,
    ownerAddress: '0x2b5ad5c4795c026514f8317c7a215e218dccd6cf',
  }
  const d: TriggerSmartContract = {
    ...base,
    ownerAddress: new Uint8Array([0x41]),
  }
  expectTypeOf(a).toEqualTypeOf<TriggerSmartContract>()
  expectTypeOf(b).toEqualTypeOf<TriggerSmartContract>()
  expectTypeOf(c).toEqualTypeOf<TriggerSmartContract>()
  expectTypeOf(d).toEqualTypeOf<TriggerSmartContract>()
})

test('WithUnknownFields shape', () => {
  expectTypeOf<WithUnknownFields['__unknown']>().toEqualTypeOf<
    UnknownField[] | undefined
  >()

  // the mixin is spread onto every model
  expectTypeOf<TransferContract['__unknown']>().toEqualTypeOf<
    UnknownField[] | undefined
  >()

  // UnknownField is a discriminated union keyed by protobuf wire type:
  // varint (0) carries a bigint, length/fixed (1|2|5) carry a Hex.
  expectTypeOf<UnknownField>().toEqualTypeOf<
    | { fieldNo: number; wireType: 0; value: bigint }
    | { fieldNo: number; wireType: 1 | 2 | 5; value: Hex }
  >()
  // both variants are constructible (the annotations alone prove this)
  const _varint: UnknownField = { fieldNo: 15, wireType: 0, value: 1n }
  const _bytes: UnknownField = { fieldNo: 16, wireType: 2, value: '0xdead' }
  void _varint
  void _bytes
  // across the union, `value` is `bigint | Hex`
  expectTypeOf<UnknownField['value']>().toEqualTypeOf<bigint | Hex>()
})

test('UnknownContractParameter (unregistered google.protobuf.Any)', () => {
  expectTypeOf<UnknownContractParameter>().toEqualTypeOf<{
    __unknown: true
    typeUrl: string
    valueBytes: ByteArray
  }>()
})

test('enum value unions', () => {
  expectTypeOf<ResourceCode>().toEqualTypeOf<0 | 1 | 2>()
  expectTypeOf<FreezeBalanceV2Contract['resource']>().toEqualTypeOf<
    number | undefined
  >()
})
