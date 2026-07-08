import { type Abi, type Address, parseAbi } from 'abitype'
import { expectTypeOf, test } from 'vitest'

import type {
  AbiItem,
  ContractFunctionArgs,
  ContractFunctionName,
  ContractFunctionReturnType,
} from './contract.js'

const trc20Abi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
])

test('ContractFunctionName', () => {
  expectTypeOf<ContractFunctionName<typeof trc20Abi>>().toEqualTypeOf<
    | 'name'
    | 'symbol'
    | 'decimals'
    | 'totalSupply'
    | 'balanceOf'
    | 'transfer'
    | 'transferFrom'
    | 'approve'
    | 'allowance'
  >()

  expectTypeOf<ContractFunctionName<typeof trc20Abi, 'view'>>().toEqualTypeOf<
    'name' | 'symbol' | 'decimals' | 'totalSupply' | 'balanceOf' | 'allowance'
  >()

  expectTypeOf<
    ContractFunctionName<typeof trc20Abi, 'nonpayable' | 'payable'>
  >().toEqualTypeOf<'transfer' | 'transferFrom' | 'approve'>()

  // non-inferrable abi falls back to `string`
  expectTypeOf<ContractFunctionName>().toEqualTypeOf<string>()
  expectTypeOf<
    ContractFunctionName<readonly unknown[]>
  >().toEqualTypeOf<string>()
})

test('ContractFunctionArgs', () => {
  expectTypeOf<
    ContractFunctionArgs<typeof trc20Abi, 'view', 'balanceOf'>
  >().toEqualTypeOf<readonly [Address]>()

  expectTypeOf<
    ContractFunctionArgs<typeof trc20Abi, 'nonpayable', 'transfer'>
  >().toEqualTypeOf<readonly [Address, bigint]>()

  expectTypeOf<
    ContractFunctionArgs<typeof trc20Abi, 'view', 'totalSupply'>
  >().toEqualTypeOf<readonly []>()

  const abi = parseAbi([
    'function foo() view returns (int8)',
    'function foo(address) view returns (string)',
    'function foo(address, address) view returns ((address foo, address bar))',
    'function bar() view returns (int8)',
  ])
  expectTypeOf<
    ContractFunctionArgs<typeof abi, 'pure' | 'view', 'foo'>
  >().toEqualTypeOf<
    readonly [] | readonly [Address] | readonly [Address, Address]
  >()

  // non-inferrable abi falls back to `readonly unknown[]`
  expectTypeOf<ContractFunctionArgs>().toEqualTypeOf<readonly unknown[]>()
})

test('ContractFunctionReturnType', () => {
  expectTypeOf<
    ContractFunctionReturnType<typeof trc20Abi, 'view', 'balanceOf'>
  >().toEqualTypeOf<bigint>()

  expectTypeOf<
    ContractFunctionReturnType<typeof trc20Abi, 'nonpayable', 'transfer'>
  >().toEqualTypeOf<boolean>()

  // empty outputs resolve to `void` (upstream parity — regression for an
  // accidental `undefined` introduced while vendoring)
  const noOutputAbi = parseAbi(['function foo()'])
  expectTypeOf<
    ContractFunctionReturnType<typeof noOutputAbi, 'nonpayable', 'foo'>
  >().toEqualTypeOf<void>()

  // multiple outputs resolve to the tuple of types
  const multiOutputAbi = parseAbi([
    'function foo() view returns (uint256, bool)',
  ])
  expectTypeOf<
    ContractFunctionReturnType<typeof multiOutputAbi, 'view', 'foo'>
  >().toEqualTypeOf<readonly [bigint, boolean]>()

  // non-inferrable abi falls back to `unknown`
  expectTypeOf<ContractFunctionReturnType>().toEqualTypeOf<unknown>()
})

test('AbiItem', () => {
  expectTypeOf<AbiItem>().toEqualTypeOf<Abi[number]>()
  expectTypeOf<(typeof trc20Abi)[number]>().toExtend<AbiItem>()
})
