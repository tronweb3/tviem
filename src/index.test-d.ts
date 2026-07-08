import { expectTypeOf, test } from 'vitest'
import { privateKeyToAddress } from './accounts/index.js'
import type {
  Address,
  ByteArray,
  ContractFunctionName,
  EvmAddress,
  Hex,
  TronHexAddress,
} from './index.js'
import {
  isAddress,
  keccak256,
  parseTrx,
  toBase58,
  toEvm,
  toTronHex,
} from './index.js'

test('branded address types', () => {
  expectTypeOf<Address>().toEqualTypeOf<`T${string}`>()
  expectTypeOf<TronHexAddress>().toEqualTypeOf<`41${string}`>()
  expectTypeOf<EvmAddress>().toEqualTypeOf<`0x${string}`>()
  expectTypeOf<Hex>().toEqualTypeOf<`0x${string}`>()
  expectTypeOf<ByteArray>().toEqualTypeOf<Uint8Array>()
})

test('address utils return branded forms', () => {
  expectTypeOf(
    toBase58('412b5ad5c4795c026514f8317c7a215e218dccd6cf'),
  ).toEqualTypeOf<Address>()
  expectTypeOf(
    toTronHex('TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K'),
  ).toEqualTypeOf<TronHexAddress>()
  expectTypeOf(
    toEvm('TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K'),
  ).toEqualTypeOf<EvmAddress>()
  expectTypeOf(
    isAddress('TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K'),
  ).toEqualTypeOf<boolean>()
})

test('units + hash return types', () => {
  expectTypeOf(parseTrx('1')).toEqualTypeOf<bigint>()
  expectTypeOf(keccak256('0x')).toEqualTypeOf<Hex>()
  expectTypeOf(keccak256('0x', 'bytes')).toEqualTypeOf<ByteArray>()
})

test('accounts barrel', () => {
  expectTypeOf(privateKeyToAddress).parameter(0).toEqualTypeOf<Hex | string>()
  expectTypeOf(privateKeyToAddress).returns.toEqualTypeOf<Address>()
})

test('ContractFunctionName resolves against a const abi', () => {
  const trc20Abi = [
    {
      inputs: [{ name: 'account', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        { name: 'recipient', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      name: 'transfer',
      outputs: [{ type: 'bool' }],
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ] as const
  expectTypeOf<
    ContractFunctionName<typeof trc20Abi, 'view'>
  >().toEqualTypeOf<'balanceOf'>()
  expectTypeOf<ContractFunctionName<typeof trc20Abi>>().toEqualTypeOf<
    'balanceOf' | 'transfer'
  >()
})
