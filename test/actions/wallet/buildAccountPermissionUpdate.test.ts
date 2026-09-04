import { expect, test } from 'vitest'
import { buildAccountPermissionUpdate } from '../../../src/actions/wallet/accountPermissionUpdate.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { hexToBytes } from '../../../src/utils/encoding/toBytes.js'
import { rpc } from '../../fixtures/rpc/loader.js'
import { loadTxFixtureFile } from '../../fixtures/tx/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

// pk = 1 (permitted trivial key) → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC,
// which is exactly the fixture `owner_address`.
const pk1 = `0x${'0'.repeat(63)}1` as const

// Same canonical permission-update gold vector as accountPermissionUpdate — the
// build half must produce the identical bytes / id (it is exactly what the full
// action signs).
const [fixture] = loadTxFixtureFile('account-permission-update-contract.json')

// The same params the full accountPermissionUpdate test pins against the vector.
const params = {
  owner: {
    permission_name: 'owner',
    threshold: 2n,
    keys: [
      { address: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC' as const, weight: 1n },
      { address: 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K' as const, weight: 1n },
    ],
  },
  actives: [
    {
      id: 2,
      permission_name: 'active0',
      threshold: 1n,
      operations:
        '0x7fff1fc0033e0300000000000000000000000000000000000000000000000000' as const,
      keys: [
        { address: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC' as const, weight: 1n },
      ],
    },
  ],
}

function buildMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasttransaction: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('builds the canonical permission update in TronWeb JSON shape, unsigned', async () => {
  const { transport, calls } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildAccountPermissionUpdate(client, params)

  // Byte-identical to what accountPermissionUpdate builds + signs + broadcasts.
  expect(tx.txID).toBe(fixture?.txID)
  expect(tx.raw_data_hex).toBe(fixture?.rawDataHex)

  // TronWeb-compatible wrapper: visible:false, no signature (unsigned).
  expect(tx.visible).toBe(false)
  expect(tx.signature).toBeUndefined()

  // Only the block was fetched — nothing was signed or broadcast.
  expect(calls.map((c) => c.path)).toEqual(['getnowblock'])
})

test('a custom blockHeader is used verbatim and skips the getnowblock fetch', async () => {
  const { transport, calls } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildAccountPermissionUpdate(client, {
    ...params,
    blockHeader: {
      ref_block_bytes: '1234',
      ref_block_hash: '0102030405060708',
      timestamp: 1700000000000n,
      expiration: 1700000000000n + 60000n,
    },
  })

  expect(tx.txID).toBe(fixture?.txID)
  expect(tx.raw_data_hex).toBe(fixture?.rawDataHex)
  expect(calls).toEqual([])
})

test('raw_data.contract[0].type is the java-tron node string', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildAccountPermissionUpdate(client, params)
  const contract = (tx.raw_data.contract as Record<string, unknown>[])[0] as {
    type: string
  }

  expect(contract.type).toBe('AccountPermissionUpdateContract')
})

test('permissionId is baked in as Permission_id and changes the id', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildAccountPermissionUpdate(client, {
    ...params,
    permissionId: 2,
  })
  const contract = (tx.raw_data.contract as Record<string, unknown>[])[0] as {
    Permission_id?: number
  }

  // TRON renders the field with a capital `P`.
  expect(contract.Permission_id).toBe(2)
  // The permission id is part of the serialized bytes → a different txID.
  expect(tx.txID).not.toBe(fixture?.txID)
  expect(tx.raw_data_hex).not.toBe(fixture?.rawDataHex)
})

test('refuses an operations bitmap that is not whole-byte hex', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })
  const active = params.actives[0]!

  // The gold bitmap with its last nibble lost. Left-padding it — which is what
  // `hexToBytes` does with an odd nibble count — would restore a 32-byte value,
  // the exact length java-tron demands, so the chain would accept it. But every
  // set bit has shifted half a byte, granting a different set of contract types
  // than the caller wrote. The action's own 32-byte guard (64 whole hex chars)
  // refuses it instead of guessing at the missing nibble.
  await expect(
    buildAccountPermissionUpdate(client, {
      ...params,
      actives: [{ ...active, operations: active.operations.slice(0, -1) }],
    }),
  ).rejects.toThrow('`operations` must be a 32-byte bitmap')

  // Raw bytes are unambiguous and stay accepted.
  const tx = await buildAccountPermissionUpdate(client, {
    ...params,
    actives: [{ ...active, operations: hexToBytes(active.operations) }],
  })
  expect(tx.txID).toBe(fixture?.txID)
})

test('throws AccountNotFoundError when no account is available (bare action)', async () => {
  const { transport } = buildMock()
  const client = createPublicClient({ transport })
  await expect(
    buildAccountPermissionUpdate(client, params),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
