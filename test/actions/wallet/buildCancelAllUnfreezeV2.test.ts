import { expect, test } from 'vitest'
import { buildCancelAllUnfreezeV2 } from '../../../src/actions/wallet/cancelAllUnfreezeV2.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { rpc } from '../../fixtures/rpc/loader.js'
import { loadTxFixtureFile } from '../../fixtures/tx/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

// pk = 1 → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC (the fixture owner).
const pk1 = `0x${'0'.repeat(63)}1` as const

// Same gold vector as cancelAllUnfreezeV2 — the build half must produce the
// identical bytes / id (it is exactly what the full action signs).
const [fixture] = loadTxFixtureFile('cancel-all-unfreeze-v2-contract.json')
const TX_ID = fixture?.txID
const RAW_DATA_HEX = fixture?.rawDataHex

function buildMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasttransaction: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('builds the canonical cancel-all-unfreeze-v2 in TronWeb JSON shape, unsigned', async () => {
  const { transport, calls } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildCancelAllUnfreezeV2(client, {})

  // Byte-identical to what cancelAllUnfreezeV2 builds.
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

  const tx = await buildCancelAllUnfreezeV2(client, {
    blockHeader: {
      ref_block_bytes: '1234',
      ref_block_hash: '0102030405060708',
      timestamp: 1700000000000n,
      expiration: 1700000000000n + 60000n,
    },
  })

  expect(tx.txID).toBe(TX_ID)
  expect(tx.raw_data_hex).toBe(RAW_DATA_HEX)
  expect(calls).toEqual([])
})

test('raw_data.contract[0].type is the node string CancelAllUnfreezeV2Contract', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildCancelAllUnfreezeV2(client, {})
  const contract = (tx.raw_data.contract as Record<string, unknown>[])[0] as {
    type: string
    parameter: { type_url: string; value: Record<string, unknown> }
  }

  expect(contract.type).toBe('CancelAllUnfreezeV2Contract')
  expect(contract.parameter.type_url).toBe(
    'type.googleapis.com/protocol.CancelAllUnfreezeV2Contract',
  )
  // snake_case key, 41-hex owner address (no 0x).
  expect(contract.parameter.value.owner_address).toMatch(/^41[0-9a-f]{40}$/)
})

test('permissionId is baked in as Permission_id and changes the id', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildCancelAllUnfreezeV2(client, { permissionId: 2 })
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
  await expect(buildCancelAllUnfreezeV2(client, {})).rejects.toBeInstanceOf(
    AccountNotFoundError,
  )
})
