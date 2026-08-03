import { expect, test } from 'vitest'
import { buildUnfreezeBalanceV2 } from '../../../src/actions/wallet/unfreezeBalanceV2.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { rpc } from '../../fixtures/rpc/loader.js'
import { loadTxFixtureFile } from '../../fixtures/tx/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

// pk = 1 → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC (the fixture owner).
const pk1 = `0x${'0'.repeat(63)}1` as const
// Chain time now comes from the pinned reference block, whose own timestamp is
// exactly this value (getnowblock.fixed), so the gold vectors are unchanged.
const blockTimestamp = 1700000000000n

// Same canonical unfreeze gold vector as unfreezeBalanceV2 — the build half must
// produce the identical bytes / id (it is exactly what unfreezeBalanceV2 signs).
const [bandwidth] = loadTxFixtureFile('unfreeze-balance-v2-contract.json')

function buildMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasthex: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('builds the canonical unfreeze in TronWeb JSON shape, unsigned', async () => {
  const { transport, calls } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildUnfreezeBalanceV2(client, {
    unfreezeBalance: 500000n,
    resource: 'BANDWIDTH',
  })

  // Byte-identical to what unfreezeBalanceV2 builds.
  expect(tx.txID).toBe(bandwidth?.txID)
  expect(tx.raw_data_hex).toBe(bandwidth?.rawDataHex)

  // TronWeb-compatible wrapper: visible:false, no signature (unsigned).
  expect(tx.visible).toBe(false)
  expect(tx.signature).toBeUndefined()

  // Only the block was fetched — nothing was signed or broadcast.
  expect(calls.map((c) => c.path)).toEqual(['getnowblock'])
})

test('a custom blockHeader is used verbatim and skips the getnowblock fetch', async () => {
  const { transport, calls } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildUnfreezeBalanceV2(client, {
    unfreezeBalance: 500000n,
    resource: 'BANDWIDTH',
    blockHeader: {
      ref_block_bytes: '1234',
      ref_block_hash: '0102030405060708',
      timestamp: blockTimestamp,
      expiration: blockTimestamp + 60000n,
    },
  })

  expect(tx.txID).toBe(bandwidth?.txID)
  expect(tx.raw_data_hex).toBe(bandwidth?.rawDataHex)
  expect(calls).toEqual([])
})

test('raw_data is java-tron node JSON (snake_case, 41-hex, string type)', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildUnfreezeBalanceV2(client, {
    unfreezeBalance: 500000n,
    resource: 'BANDWIDTH',
  })
  const contract = (tx.raw_data.contract as Record<string, unknown>[])[0] as {
    type: string
    parameter: { type_url: string; value: Record<string, unknown> }
  }

  expect(contract.type).toBe('UnfreezeBalanceV2Contract')
  expect(contract.parameter.type_url).toBe(
    'type.googleapis.com/protocol.UnfreezeBalanceV2Contract',
  )
  // snake_case keys, 41-hex owner (no 0x), int64 as a JSON number.
  expect(contract.parameter.value.owner_address).toMatch(/^41[0-9a-f]{40}$/)
  expect(contract.parameter.value.unfreeze_balance).toBe(500000)
  // TaPoS + timing fields present.
  expect(tx.raw_data.ref_block_bytes).toBeDefined()
  expect(tx.raw_data.ref_block_hash).toBeDefined()
  expect(tx.raw_data.expiration).toBeDefined()
  expect(tx.raw_data.timestamp).toBe(Number(blockTimestamp))
})

test('permissionId is baked in as Permission_id and changes the id', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildUnfreezeBalanceV2(client, {
    unfreezeBalance: 500000n,
    resource: 'BANDWIDTH',
    permissionId: 2,
  })
  const contract = (tx.raw_data.contract as Record<string, unknown>[])[0] as {
    Permission_id?: number
  }

  // TRON renders the field with a capital `P`.
  expect(contract.Permission_id).toBe(2)
  // The permission id is part of the serialized bytes → a different txID.
  expect(tx.txID).not.toBe(bandwidth?.txID)
  expect(tx.raw_data_hex).not.toBe(bandwidth?.rawDataHex)
})

test('throws AccountNotFoundError when no account is available (bare action)', async () => {
  const { transport } = buildMock()
  const client = createPublicClient({ transport })
  await expect(
    buildUnfreezeBalanceV2(client, {
      unfreezeBalance: 500000n,
      resource: 'BANDWIDTH',
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
