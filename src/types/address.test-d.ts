import { expectTypeOf, test } from 'vitest'

import type {
  Address,
  AddressInput,
  EvmAddress,
  TronHexAddress,
} from './address.js'

test('Address', () => {
  expectTypeOf<Address>().toEqualTypeOf<`T${string}`>()

  // §2.1 vectors (V1 / V2 / V3)
  expectTypeOf<'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'>().toExtend<Address>()
  expectTypeOf<'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K'>().toExtend<Address>()
  expectTypeOf<'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'>().toExtend<Address>()

  // plain string is not assignable (template-literal brand)
  expectTypeOf<string>().not.toExtend<Address>()
  // hex forms are not the canonical Base58Check form
  expectTypeOf<'0x2b5ad5c4795c026514f8317c7a215e218dccd6cf'>().not.toExtend<Address>()
  expectTypeOf<'412b5ad5c4795c026514f8317c7a215e218dccd6cf'>().not.toExtend<Address>()
})

test('TronHexAddress', () => {
  expectTypeOf<TronHexAddress>().toEqualTypeOf<`41${string}`>()

  expectTypeOf<'412b5ad5c4795c026514f8317c7a215e218dccd6cf'>().toExtend<TronHexAddress>()
  expectTypeOf<'417e5f4552091a69125d5dfcb7b8c2659029395bdf'>().toExtend<TronHexAddress>()

  expectTypeOf<string>().not.toExtend<TronHexAddress>()
  expectTypeOf<'0x2b5ad5c4795c026514f8317c7a215e218dccd6cf'>().not.toExtend<TronHexAddress>()
  expectTypeOf<'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K'>().not.toExtend<TronHexAddress>()
})

test('EvmAddress', () => {
  expectTypeOf<EvmAddress>().toEqualTypeOf<`0x${string}`>()

  expectTypeOf<'0x2b5ad5c4795c026514f8317c7a215e218dccd6cf'>().toExtend<EvmAddress>()

  expectTypeOf<string>().not.toExtend<EvmAddress>()
  expectTypeOf<'412b5ad5c4795c026514f8317c7a215e218dccd6cf'>().not.toExtend<EvmAddress>()
  expectTypeOf<'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K'>().not.toExtend<EvmAddress>()
})

test('AddressInput', () => {
  expectTypeOf<AddressInput>().toEqualTypeOf<
    Address | TronHexAddress | EvmAddress
  >()

  // wide-in: all three forms are accepted
  expectTypeOf<Address>().toExtend<AddressInput>()
  expectTypeOf<TronHexAddress>().toExtend<AddressInput>()
  expectTypeOf<EvmAddress>().toExtend<AddressInput>()
  expectTypeOf<'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'>().toExtend<AddressInput>()
  expectTypeOf<'412b5ad5c4795c026514f8317c7a215e218dccd6cf'>().toExtend<AddressInput>()
  expectTypeOf<'0x2b5ad5c4795c026514f8317c7a215e218dccd6cf'>().toExtend<AddressInput>()

  // but not arbitrary strings
  expectTypeOf<string>().not.toExtend<AddressInput>()
  expectTypeOf<'hello'>().not.toExtend<AddressInput>()
})
