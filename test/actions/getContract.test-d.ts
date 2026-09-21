import { expectTypeOf, test } from 'vitest'
import type { SignableTransaction } from '../../src/accounts/types.js'
import {
  type GetEventsOptions,
  getContract,
} from '../../src/actions/getContract.js'
import type { Client } from '../../src/clients/createClient.js'
import type { PublicClient } from '../../src/clients/createPublicClient.js'
import type { WalletClient } from '../../src/clients/createWalletClient.js'
import type { AddressInput } from '../../src/types/address.js'
import type { Hex } from '../../src/types/misc.js'

const trc20Abi = [
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
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const

const address = 'TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe'

test('read.<fn> parameter and return inference (Public Client)', () => {
  const publicClient = {} as PublicClient
  const contract = getContract({ abi: trc20Abi, address, client: publicClient })

  // `read` is present on a Public Client.
  expectTypeOf(contract).toHaveProperty('read')
  // `write` / `estimateEnergy` are NOT (no `writeContract` on a Public Client).
  expectTypeOf(contract).not.toHaveProperty('write')
  expectTypeOf(contract).not.toHaveProperty('estimateEnergy')

  // balanceOf: `address` arg accepts any TRON form (Base58 / hex / EVM);
  // resolves to `bigint`.
  expectTypeOf(contract.read.balanceOf)
    .parameter(0)
    .toEqualTypeOf<readonly [AddressInput]>()
  expectTypeOf(contract.read.balanceOf).returns.resolves.toEqualTypeOf<bigint>()

  // totalSupply: no inputs → args tuple is elided, first parameter is options.
  expectTypeOf(
    contract.read.totalSupply,
  ).returns.resolves.toEqualTypeOf<bigint>()

  // address / abi are carried through.
  expectTypeOf(contract.address).toEqualTypeOf<typeof address>()
  expectTypeOf(contract.abi).toEqualTypeOf<typeof trc20Abi>()
})

test('write.<fn> / estimateEnergy.<fn> parameter inference (Wallet Client)', () => {
  const walletClient = {} as WalletClient
  const contract = getContract({ abi: trc20Abi, address, client: walletClient })

  // `write` / `estimateEnergy` are present on a Wallet Client.
  expectTypeOf(contract).toHaveProperty('write')
  expectTypeOf(contract).toHaveProperty('estimateEnergy')
  // `read` is NOT (no `readContract` on a bare Wallet Client).
  expectTypeOf(contract).not.toHaveProperty('read')

  // transfer: `(address, uint256)` → args `readonly [AddressInput, bigint | number]`,
  // resolves to the local txID plus the broadcast acknowledgement fields and
  // the broadcast transaction.
  expectTypeOf(contract.write.transfer)
    .parameter(0)
    .toEqualTypeOf<readonly [AddressInput, bigint | number]>()
  expectTypeOf(contract.write.transfer).returns.resolves.toEqualTypeOf<{
    txID: string
    result?: boolean | undefined
    code?: string | undefined
    message?: string | undefined
    transaction: SignableTransaction
  }>()

  // estimateEnergy.transfer: same args, resolves to `bigint`.
  expectTypeOf(contract.estimateEnergy.transfer)
    .parameter(0)
    .toEqualTypeOf<readonly [AddressInput, bigint | number]>()
  expectTypeOf(
    contract.estimateEnergy.transfer,
  ).returns.resolves.toEqualTypeOf<bigint>()
})

test('getEvents is always present', () => {
  const client = {} as Client
  const contract = getContract({ abi: trc20Abi, address, client })
  expectTypeOf(contract).toHaveProperty('getEvents')
})

// `getLogs` types its block selectors as mutually exclusive — a range, or one
// block by hash — and refuses the combination at runtime. The facade's options
// were a flat object with all three independently optional, so it compiled a
// call the action it feeds rejects, deferring a typo-level mistake to runtime.
test('getEvents block selectors are mutually exclusive, as in getLogs', () => {
  const client = {} as Client
  const contract = getContract({ abi: trc20Abi, address, client })
  type Options = NonNullable<Parameters<typeof contract.getEvents.Transfer>[0]>

  // A range, or a single block by hash — each with the shared filters.
  expectTypeOf<{ fromBlock: bigint; toBlock: 'latest' }>().toExtend<Options>()
  expectTypeOf<{ blockHash: Hex }>().toExtend<Options>()
  expectTypeOf<{
    blockHash: Hex
    args: { from: AddressInput }
    strict: boolean
  }>().toExtend<Options>()
  expectTypeOf<{
    fromBlock: bigint
    args: readonly unknown[]
    strict: boolean
  }>().toExtend<Options>()

  // Never both.
  expectTypeOf<{ blockHash: Hex; fromBlock: bigint }>().not.toExtend<Options>()
  expectTypeOf<{ blockHash: Hex; toBlock: bigint }>().not.toExtend<Options>()
  expectTypeOf<{
    blockHash: Hex
    fromBlock: bigint
  }>().not.toExtend<GetEventsOptions>()

  // Forwarding an unset selector as `undefined` stays legal on either side
  // (`exactOptionalPropertyTypes`): a wrapper holds `Hex | undefined`.
  expectTypeOf<{
    blockHash: undefined
    fromBlock: bigint
  }>().toExtend<Options>()
  expectTypeOf<{ blockHash: Hex; fromBlock: undefined }>().toExtend<Options>()
})
