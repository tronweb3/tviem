import { expectTypeOf, test } from 'vitest'
import { estimateEnergy } from '../../src/actions/public/estimateEnergy.js'
import {
  type ReadContractParameters,
  readContract,
} from '../../src/actions/public/readContract.js'
import {
  type WriteContractParameters,
  writeContract,
} from '../../src/actions/wallet/writeContract.js'
import type { Client } from '../../src/clients/createClient.js'
import type { Address, AddressInput } from '../../src/types/address.js'

declare const client: Client

/** A typical TRC-20-ish ABI, const-asserted so inference can see literals. */
const abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

test('readContract infers the return type from the ABI outputs', () => {
  expectTypeOf(
    readContract(client, {
      address: 'T…',
      abi,
      functionName: 'balanceOf',
      args: ['T…'],
    }),
  ).resolves.toEqualTypeOf<bigint>()
  // address outputs decode to the Base58Check-branded Address.
  expectTypeOf(
    readContract(client, {
      address: 'T…',
      abi,
      functionName: 'ownerOf',
      args: [1n],
    }),
  ).resolves.toEqualTypeOf<Address>()
})

test('readContract rejects a typo’d / non-view functionName', () => {
  readContract(client, {
    address: 'T…',
    abi,
    // @ts-expect-error typo — not a function of the ABI
    functionName: 'balnceOf',
    args: ['T…'],
  })
  readContract(client, {
    address: 'T…',
    abi,
    // @ts-expect-error transfer is nonpayable, not pure/view
    functionName: 'transfer',
    args: ['T…'],
  })
  // The name unions are partitioned by mutability.
  expectTypeOf<
    ReadContractParameters<typeof abi>['functionName']
  >().toEqualTypeOf<'balanceOf' | 'totalSupply' | 'ownerOf'>()
  expectTypeOf<
    WriteContractParameters<typeof abi>['functionName']
  >().toEqualTypeOf<'transfer'>()
})

test('readContract args are TRON-flavored and arity-checked', () => {
  // address inputs accept any TRON form (T… Base58Check, 41-hex, 0x-hex).
  expectTypeOf(readContract<typeof abi, 'balanceOf'>)
    .parameter(1)
    .toHaveProperty('args')
    .toEqualTypeOf<readonly [AddressInput]>()
  readContract(client, {
    address: 'T…',
    abi,
    functionName: 'balanceOf',
    // @ts-expect-error wrong arity — balanceOf takes exactly one argument
    args: [],
  })
  // @ts-expect-error args are required when the function has inputs
  readContract(client, { address: 'T…', abi, functionName: 'balanceOf' })
  // args may be omitted when the function takes none.
  readContract(client, { address: 'T…', abi, functionName: 'totalSupply' })
})

test('a wide (non-const) abi keeps the loose call shape', () => {
  const wideAbi = abi as readonly unknown[]
  expectTypeOf(
    readContract(client, {
      address: 'T…',
      abi: wideAbi,
      functionName: 'anything',
      args: ['whatever', 123],
    }),
  ).resolves.toBeUnknown()
})

/** Overloaded + cross-mutability ABIs — the TS-1/TS-2 regression cases. */
const overloadAbi = [
  {
    type: 'function',
    name: 'bar',
    stateMutability: 'view',
    inputs: [{ name: 'a', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'bar',
    stateMutability: 'view',
    inputs: [
      { name: 'a', type: 'address' },
      { name: 'b', type: 'address' },
    ],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'foo',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'foo',
    stateMutability: 'view',
    inputs: [{ name: 'x', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'thing',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'thing',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'a', type: 'address' }],
    outputs: [],
  },
] as const

test('overloads narrow by args instead of collapsing to never', () => {
  // Two non-empty view overloads: args pick the overload, not `never`.
  expectTypeOf(
    readContract(client, {
      address: 'T…',
      abi: overloadAbi,
      functionName: 'bar',
      args: ['T…'],
    }),
  ).resolves.toEqualTypeOf<bigint>()
  expectTypeOf(
    readContract(client, {
      address: 'T…',
      abi: overloadAbi,
      functionName: 'bar',
      args: ['T…', 'T…'],
    }),
  ).resolves.toEqualTypeOf<string>()
  // Zero-arg overload pair: argless picks the zero-arg one, args pick the other.
  expectTypeOf(
    readContract(client, {
      address: 'T…',
      abi: overloadAbi,
      functionName: 'foo',
    }),
  ).resolves.toEqualTypeOf<boolean>()
  expectTypeOf(
    readContract(client, {
      address: 'T…',
      abi: overloadAbi,
      functionName: 'foo',
      args: [123n],
    }),
  ).resolves.toEqualTypeOf<string>()
})

test('cross-mutability overloads stay partitioned per action', () => {
  // Only the nonpayable `thing(address)` is writable — argless must not
  // compile (the view zero-arg overload must not leak into the write side).
  // @ts-expect-error args are required — the view overload is not writable
  writeContract(client, {
    address: 'T…',
    abi: overloadAbi,
    functionName: 'thing',
  })
  writeContract(client, {
    address: 'T…',
    abi: overloadAbi,
    functionName: 'thing',
    args: ['T…'],
  })
  // And the read side only sees the zero-arg view overload.
  expectTypeOf(
    readContract(client, {
      address: 'T…',
      abi: overloadAbi,
      functionName: 'thing',
    }),
  ).resolves.toEqualTypeOf<bigint>()
})

test('a wrong-mutability abi degrades the parameter shape honestly', () => {
  const writeOnlyAbi = [
    {
      type: 'function',
      name: 'transfer',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    },
  ] as const
  // No view functions: functionName degrades to string, args to the wide
  // optional shape, and the return to unknown — never a confident lie.
  expectTypeOf<
    ReadContractParameters<typeof writeOnlyAbi>['functionName']
  >().toEqualTypeOf<string>()
  expectTypeOf(
    readContract(client, {
      address: 'T…',
      abi: writeOnlyAbi,
      functionName: 'whatever',
    }),
  ).resolves.toBeUnknown()
})

test('writeContract / estimateEnergy narrow to nonpayable|payable names', () => {
  writeContract(client, {
    address: 'T…',
    abi,
    functionName: 'transfer',
    args: ['T…', 1n],
  })
  writeContract(client, {
    address: 'T…',
    abi,
    // @ts-expect-error balanceOf is view — not writable
    functionName: 'balanceOf',
    args: ['T…', 1n],
  })
  expectTypeOf(
    estimateEnergy(client, {
      address: 'T…',
      abi,
      functionName: 'transfer',
      args: ['T…', 1n],
    }),
  ).resolves.toEqualTypeOf<bigint>()
})
