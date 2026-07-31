import { expect, test } from 'vitest'
import { buildDelegateResource } from '../../../src/actions/wallet/delegateResource.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import type { Address } from '../../../src/types/address.js'
import { rpc } from '../../fixtures/rpc/loader.js'
import { loadTxFixtureFile } from '../../fixtures/tx/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

// pk = 1 (permitted trivial key) → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC,
// which is exactly the fixture `owner_address`.
const pk1 = `0x${'0'.repeat(63)}1` as const
const receiver = 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K' as Address
// Chain time now comes from the pinned reference block, whose own timestamp is
// exactly this value (getnowblock.fixed), so the gold vectors are unchanged.
const blockTimestamp = 1700000000000n

// Same canonical delegate gold vector as delegateResource — the build half must
// produce the identical bytes / id (it is exactly what delegateResource signs).
const [unlocked] = loadTxFixtureFile('delegate-resource-contract.json')
const TX_ID = unlocked?.txID
const RAW_DATA_HEX = unlocked?.rawDataHex

function buildMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasthex: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('builds the canonical delegation in TronWeb JSON shape, unsigned', async () => {
  const { transport, calls } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildDelegateResource(client, {
    receiverAddress: receiver,
    balance: 1000000n,
    resource: 'BANDWIDTH',
    lock: false,
  })

  // Byte-identical to what delegateResource builds.
  expect(tx.txID).toBe(TX_ID)
  expect(tx.raw_data_hex).toBe(RAW_DATA_HEX)

  // TronWeb-compatible wrapper: visible:false, no signature (unsigned).
  expect(tx.visible).toBe(false)
  expect(tx.signature).toBeUndefined()

  // Only the block was fetched — nothing was signed or broadcast.
  expect(calls.map((c) => c.path)).toEqual(['getnowblock'])
})

test('a custom blockHeader is used verbatim and skips the getnowblock fetch', async () => {
  const { transport, calls } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildDelegateResource(client, {
    receiverAddress: receiver,
    balance: 1000000n,
    resource: 'BANDWIDTH',
    lock: false,
    blockHeader: {
      ref_block_bytes: '1234',
      ref_block_hash: '0102030405060708',
      timestamp: blockTimestamp,
      expiration: blockTimestamp + 60000n,
    },
  })

  expect(tx.txID).toBe(TX_ID)
  expect(tx.raw_data_hex).toBe(RAW_DATA_HEX)
  expect(calls).toEqual([])
})

test('raw_data is java-tron node JSON (snake_case, 41-hex, string type)', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildDelegateResource(client, {
    receiverAddress: receiver,
    balance: 1000000n,
    resource: 'BANDWIDTH',
    lock: false,
  })
  const contract = (tx.raw_data.contract as Record<string, unknown>[])[0] as {
    type: string
    parameter: { type_url: string; value: Record<string, unknown> }
  }

  expect(contract.type).toBe('DelegateResourceContract')
  expect(contract.parameter.type_url).toBe(
    'type.googleapis.com/protocol.DelegateResourceContract',
  )
  // snake_case keys, 41-hex addresses (no 0x), int64 as a JSON number.
  expect(contract.parameter.value.owner_address).toMatch(/^41[0-9a-f]{40}$/)
  expect(contract.parameter.value.receiver_address).toMatch(/^41[0-9a-f]{40}$/)
  expect(contract.parameter.value.balance).toBe(1000000)
  // TaPoS + timing fields present.
  expect(tx.raw_data.ref_block_bytes).toBeDefined()
  expect(tx.raw_data.ref_block_hash).toBeDefined()
  expect(tx.raw_data.expiration).toBeDefined()
  expect(tx.raw_data.timestamp).toBe(Number(blockTimestamp))
})

test('permissionId is baked in as Permission_id and changes the id', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildDelegateResource(client, {
    receiverAddress: receiver,
    balance: 1000000n,
    resource: 'BANDWIDTH',
    lock: false,
    permissionId: 2,
  })
  const contract = (tx.raw_data.contract as Record<string, unknown>[])[0] as {
    Permission_id?: number
  }

  // TRON renders the field with a capital `P`.
  expect(contract.Permission_id).toBe(2)
  // The permission id is part of the serialized bytes → a different txID.
  expect(tx.txID).not.toBe(TX_ID)
  expect(tx.raw_data_hex).not.toBe(RAW_DATA_HEX)
})

test('throws AccountNotFoundError when no account is available (bare action)', async () => {
  const { transport } = buildMock()
  const client = createPublicClient({ transport })
  await expect(
    buildDelegateResource(client, {
      receiverAddress: receiver,
      balance: 1n,
      resource: 'BANDWIDTH',
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
