import { expectTypeOf, test } from 'vitest'
import { privateKeyToAddress } from '../src/accounts/index.js'
import type {
  Address,
  ByteArray,
  Chain,
  Client,
  ContractFunctionName,
  EvmAddress,
  Hex,
  PublicClient,
  RequestErrorType,
  Transport,
  TronHexAddress,
  TronRequestFn,
} from '../src/index.js'
import {
  addressToHex,
  createPublicClient,
  http,
  isAddress,
  keccak256,
  nile,
  parseTrx,
  toBase58,
  toEvm,
} from '../src/index.js'

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
    addressToHex('TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K'),
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

test('root barrel exposes the client / transport / chain type surface', () => {
  const client = createPublicClient({ chain: nile, transport: http() })
  // Client carries the read action set and a wrapped request fn.
  expectTypeOf(client).toMatchTypeOf<PublicClient>()
  expectTypeOf(client).toMatchTypeOf<Client>()
  expectTypeOf(client.request).toEqualTypeOf<TronRequestFn>()
  expectTypeOf(client.readContract).toBeFunction()
  expectTypeOf(client.getBalance).toBeFunction()
  // Chain / Transport are re-exported as types.
  expectTypeOf(nile).toMatchTypeOf<Chain>()
  expectTypeOf(http).returns.toMatchTypeOf<Transport>()
})

test('RequestErrorType is importable from the root entrypoint', () => {
  // The error-union building block every action's *ErrorType references; it
  // must be nameable by consumers, not only resolvable structurally.
  expectTypeOf<RequestErrorType>().not.toBeNever()
})
