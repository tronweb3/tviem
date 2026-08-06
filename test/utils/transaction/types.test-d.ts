// Type-surface tests for the transaction contract-parameter models (Track D):
// i64 fields are `Int64` (canonical JSON form: number | decimal string),
// address fields are the wide-in `ContractAddressInput`, and enum fields
// carry their JsonFormat name union.
import { expectTypeOf, test } from 'vitest'

import type {
  Address,
  AddressInput,
  EvmAddress,
  TronHexAddress,
} from '../../../src/types/address.js'
import type { ByteArray } from '../../../src/types/misc.js'
import type {
  ContractAddressInput,
  DelegateResourceContract,
  FreezeBalanceV2Contract,
  Int64,
  PermissionKey,
  ResourceCode,
  ResourceCodeName,
  TransferContract,
  TriggerSmartContract,
  Vote,
} from '../../../src/utils/transaction/types.js'

test('i64 fields are Int64 (bigint | number | string in; number|string canonical)', () => {
  expectTypeOf<Int64>().toEqualTypeOf<bigint | number | string>()
  expectTypeOf<TransferContract['amount']>().toEqualTypeOf<Int64>()
  expectTypeOf<Vote['vote_count']>().toEqualTypeOf<Int64>()
  expectTypeOf<PermissionKey['weight']>().toEqualTypeOf<Int64>()
  expectTypeOf<
    FreezeBalanceV2Contract['frozen_balance']
  >().toEqualTypeOf<Int64>()
  expectTypeOf<DelegateResourceContract['balance']>().toEqualTypeOf<Int64>()

  // optional i64 fields are `Int64 | undefined` (exactOptionalPropertyTypes)
  expectTypeOf<TriggerSmartContract['call_value']>().toEqualTypeOf<
    Int64 | undefined
  >()
  expectTypeOf<TriggerSmartContract['token_id']>().toEqualTypeOf<
    Int64 | undefined
  >()
  expectTypeOf<DelegateResourceContract['lock_period']>().toEqualTypeOf<
    Int64 | undefined
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
  const base: Omit<TriggerSmartContract, 'owner_address'> = {
    contract_address: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
    data: '0xa9059cbb',
  }
  // Base58, TRON hex, EVM hex, and raw bytes are all assignable.
  expectTypeOf<Address>().toExtend<TriggerSmartContract['owner_address']>()
  const a: TriggerSmartContract = {
    ...base,
    owner_address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  }
  const b: TriggerSmartContract = {
    ...base,
    owner_address: '412b5ad5c4795c026514f8317c7a215e218dccd6cf',
  }
  const c: TriggerSmartContract = {
    ...base,
    owner_address: '0x2b5ad5c4795c026514f8317c7a215e218dccd6cf',
  }
  const d: TriggerSmartContract = {
    ...base,
    owner_address: new Uint8Array([0x41]),
  }
  expectTypeOf(a).toEqualTypeOf<TriggerSmartContract>()
  expectTypeOf(b).toEqualTypeOf<TriggerSmartContract>()
  expectTypeOf(c).toEqualTypeOf<TriggerSmartContract>()
  expectTypeOf(d).toEqualTypeOf<TriggerSmartContract>()
})

test('enum value unions', () => {
  expectTypeOf<ResourceCode>().toEqualTypeOf<0 | 1 | 2>()
  expectTypeOf<ResourceCodeName>().toEqualTypeOf<
    'BANDWIDTH' | 'ENERGY' | 'TRON_POWER'
  >()
  // enum fields accept the JsonFormat name (canonical) or the wire integer
  expectTypeOf<FreezeBalanceV2Contract['resource']>().toEqualTypeOf<
    ResourceCodeName | number | undefined
  >()
})
