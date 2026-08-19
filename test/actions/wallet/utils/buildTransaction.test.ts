import { expect, test } from 'vitest'
import {
  buildTransaction,
  type TransactionHeader,
} from '../../../../src/actions/wallet/utils/buildTransaction.js'
import { createPublicClient } from '../../../../src/clients/createPublicClient.js'
import { parseAccount } from '../../../../src/types/account.js'
import { addressToHex } from '../../../../src/utils/address/addressToHex.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../../../src/utils/transaction/registry.js'
import type { RawContract } from '../../../../src/utils/transaction/serializeRawData.js'
import { rpc } from '../../../fixtures/rpc/loader.js'
import { createMockTransport } from '../../../mock/createMockTransport.js'

// pk = 1 → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC.
const pk1 = `0x${'0'.repeat(63)}1` as const

function buildMock() {
  return createMockTransport({
    responses: { getnowblock: { response: rpc('getnowblock.fixed') } },
  })
}

function freezeContract(): RawContract {
  return {
    type: ContractType.FreezeBalanceV2Contract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}FreezeBalanceV2Contract`,
      value: {
        owner_address: addressToHex(parseAccount(pk1).address),
        frozen_balance: 1000000n,
      },
    },
  }
}

/** The `Permission_id` the built transaction carries, if any. */
function permissionIdOf(tx: { raw_data: { contract: unknown[] } }) {
  const contracts = tx.raw_data.contract as { Permission_id?: number }[]
  return contracts[0]!.Permission_id
}

test('binds a valid permission id, and omits the field for the owner id 0', async () => {
  const { transport } = buildMock()
  const client = createPublicClient({ transport })

  const active = await buildTransaction(client, {
    contract: freezeContract(),
    permissionId: 2,
  })
  expect(permissionIdOf(active)).toBe(2)

  // Id 0 is the owner permission, which proto3 drops from the wire — an
  // absent `Permission_id` IS id 0. Writing an explicit 0 would be wrong.
  const owner = await buildTransaction(client, {
    contract: freezeContract(),
    permissionId: 0,
  })
  expect(permissionIdOf(owner)).toBeUndefined()
})

test('rejects a negative or non-integer permission id', async () => {
  const { transport } = buildMock()
  const client = createPublicClient({ transport })
  const build = (permissionId: number) =>
    buildTransaction(client, { contract: freezeContract(), permissionId })

  // A negative id would encode as a 10-byte two's-complement varint and decode
  // back past Number's precision, yielding a transaction that fails the SDK's
  // own txCheck — built, signable, and self-inconsistent.
  await expect(build(-1)).rejects.toThrow(
    'Invalid multi-sig permission id: -1. Expected a non-negative integer',
  )
  // A non-integer would otherwise escape `BigInt()` as a raw RangeError thrown
  // from the protobuf writer, which no exported error union covers.
  await expect(build(1.5)).rejects.toThrow(
    'Invalid multi-sig permission id: 1.5. Expected a non-negative integer',
  )
})

test('rejects the permission id before any node call', async () => {
  const { transport, calls } = buildMock()
  const client = createPublicClient({ transport })

  // No `blockHeader`, so a build that got past the guard would have to fetch
  // the latest block. Nothing must reach the transport.
  await expect(
    buildTransaction(client, { contract: freezeContract(), permissionId: -1 }),
  ).rejects.toThrow('Invalid multi-sig permission id')
  expect(calls).toHaveLength(0)
})

test('format-checks a blockHeader override before signing', async () => {
  const { transport, calls } = buildMock()
  const client = createPublicClient({ transport })
  const good = {
    ref_block_bytes: '1234',
    ref_block_hash: '0102030405060708',
    expiration: 1700000060000n,
    timestamp: 1700000000000n,
  }
  const build = (blockHeader: TransactionHeader) =>
    buildTransaction(client, { contract: freezeContract(), blockHeader })

  await expect(build(good)).resolves.toBeDefined()

  // A zero expiration would serialize to no field at all — a signable
  // transaction that never expires client-side and is only refused by the
  // node at broadcast.
  await expect(build({ ...good, expiration: 0 })).rejects.toThrow(
    'Invalid blockHeader.expiration',
  )
  await expect(build({ ...good, timestamp: 1.5 })).rejects.toThrow(
    'Invalid blockHeader.timestamp',
  )
  // Sized fields: an odd nibble count would otherwise be left-padded into
  // different TaPoS bytes, and an empty value dropped from the wire.
  await expect(build({ ...good, ref_block_bytes: '123' })).rejects.toThrow(
    'Invalid blockHeader.ref_block_bytes',
  )
  await expect(build({ ...good, ref_block_bytes: '' })).rejects.toThrow(
    'Invalid blockHeader.ref_block_bytes',
  )
  await expect(build({ ...good, ref_block_hash: '01020304' })).rejects.toThrow(
    'Invalid blockHeader.ref_block_hash',
  )

  // The override path is offline: nothing above may touch the node.
  expect(calls.filter((c) => c.path === 'getnowblock')).toHaveLength(0)
})

test('leaves a large permission id to the node', async () => {
  const { transport } = buildMock()
  const client = createPublicClient({ transport })

  // java-tron imposes no numeric maximum: the id must resolve to a permission
  // on the signing account, which cannot be checked offline. Bounding it here
  // would make the SDK stricter than the chain.
  const tx = await buildTransaction(client, {
    contract: freezeContract(),
    permissionId: 1000,
  })
  expect(permissionIdOf(tx)).toBe(1000)
})
