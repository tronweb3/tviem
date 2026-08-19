import type { Abi } from 'abitype'
import { test } from 'vitest'
import type { WalletClient } from '../../../src/clients/createWalletClient.js'

const client = {} as WalletClient

const withArgs = [
  {
    type: 'constructor',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'cap', type: 'uint256' },
    ],
  },
] as const

const noArgs = [
  { type: 'constructor', stateMutability: 'nonpayable', inputs: [] },
] as const

const noCtor = [
  {
    type: 'function',
    name: 'f',
    stateMutability: 'view',
    inputs: [],
    outputs: [],
  },
] as const

test('a constructor with inputs makes args required and typed', () => {
  // The generic must survive the client decorator — a non-generic decorator
  // declaration widens `abi` to `Abi` and erases all of this.
  client.deployContract({
    abi: withArgs,
    bytecode: '0x60',
    args: ['TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC', 100n],
  })

  // @ts-expect-error — args are required when the constructor declares inputs.
  client.deployContract({ abi: withArgs, bytecode: '0x60' })

  client.deployContract({
    abi: withArgs,
    bytecode: '0x60',
    // @ts-expect-error — wrong arity.
    args: ['TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'],
  })

  client.deployContract({
    abi: withArgs,
    bytecode: '0x60',
    // @ts-expect-error — wrong types.
    args: [123, 'junk'],
  })
})

test('an argless or absent constructor keeps args optional', () => {
  client.buildDeployContract({ abi: noArgs, bytecode: '0x60' })
  client.buildDeployContract({ abi: noCtor, bytecode: '0x60' })
})

test('the wide (non-const) instantiation keeps args optional', () => {
  // Callers holding a runtime `Abi` (no `as const`) must keep the wide call
  // shape: args optional, any array accepted.
  const runtimeAbi = [] as unknown as Abi
  client.deployContract({ abi: runtimeAbi, bytecode: '0x60' })
  client.deployContract({
    abi: runtimeAbi,
    bytecode: '0x60',
    args: ['anything', 1n],
  })
})
