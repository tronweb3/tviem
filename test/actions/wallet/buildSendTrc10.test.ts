import { expect, test } from 'vitest'
import { buildSendTrc10 } from '../../../src/actions/wallet/sendTrc10.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { InvalidHexValueError } from '../../../src/errors/encoding.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import type { Address } from '../../../src/types/address.js'
import { rpc } from '../../fixtures/rpc/loader.js'
import { loadTxFixtureFile } from '../../fixtures/tx/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

// pk = 1 (permitted trivial key) → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC,
// which is exactly the fixture `owner_address`.
const pk1 = `0x${'0'.repeat(63)}1` as const
// Chain time now comes from the pinned reference block, whose own timestamp is
// exactly this value (getnowblock.fixed), so the gold vectors are unchanged.
const blockTimestamp = 1700000000000n

// Same canonical TRC10 gold vectors as sendTrc10 — the build half must produce
// the identical bytes / id (it is exactly what sendTrc10 signs). The fixture
// pins two input forms (UTF-8 asset id / 0x-hex) that share one wire encoding.
const [utf8Form, hexForm] = loadTxFixtureFile('transfer-asset-contract.json')

// Recipient decodes to 41-hex 412b5ad5c4795c026514f8317c7a215e218dccd6cf.
const to = 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K' as Address

function buildMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasttransaction: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('builds the canonical TRC10 transfer in TronWeb JSON shape, unsigned', async () => {
  const { transport, calls } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildSendTrc10(client, {
    to,
    assetName: '1002000',
    amount: 1000n,
  })

  // Byte-identical to what sendTrc10 builds and signs.
  expect(tx.txID).toBe(utf8Form?.txID)
  expect(tx.raw_data_hex).toBe(utf8Form?.rawDataHex)

  // TronWeb-compatible wrapper: visible:false, no signature (unsigned).
  expect(tx.visible).toBe(false)
  expect(tx.signature).toBeUndefined()

  // The node string for TRC10 transfers.
  const contract = (tx.raw_data.contract as Record<string, unknown>[])[0] as {
    type: string
  }
  expect(contract.type).toBe('TransferAssetContract')

  // Only the block was fetched — nothing was signed or broadcast.
  expect(calls.map((c) => c.path)).toEqual(['getnowblock'])
})

test('a custom blockHeader is used verbatim and skips the getnowblock fetch', async () => {
  const { transport, calls } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildSendTrc10(client, {
    to,
    assetName: '1002000',
    amount: 1000n,
    blockHeader: {
      ref_block_bytes: '1234',
      ref_block_hash: '0102030405060708',
      timestamp: blockTimestamp,
      expiration: blockTimestamp + 60000n,
    },
  })

  expect(tx.txID).toBe(utf8Form?.txID)
  expect(tx.raw_data_hex).toBe(utf8Form?.rawDataHex)
  expect(calls).toEqual([])
})

test('raw_data is java-tron node JSON (snake_case, 41-hex, string type)', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildSendTrc10(client, {
    to,
    assetName: '1002000',
    amount: 1000n,
  })
  const contract = (tx.raw_data.contract as Record<string, unknown>[])[0] as {
    type: string
    parameter: { type_url: string; value: Record<string, unknown> }
  }

  expect(contract.type).toBe('TransferAssetContract')
  expect(contract.parameter.type_url).toBe(
    'type.googleapis.com/protocol.TransferAssetContract',
  )
  // snake_case keys, 41-hex addresses (no 0x), int64 as a JSON number. The flex
  // asset_name is hex-encoded like java-tron (visible:false): the token id
  // "1002000" → its ASCII bytes as bare hex "31303032303030".
  expect(contract.parameter.value.owner_address).toMatch(/^41[0-9a-f]{40}$/)
  expect(contract.parameter.value.to_address).toMatch(/^41[0-9a-f]{40}$/)
  expect(contract.parameter.value.asset_name).toBe('31303032303030')
  expect(contract.parameter.value.amount).toBe(1000)
  // TaPoS + timing fields present.
  expect(tx.raw_data.ref_block_bytes).toBeDefined()
  expect(tx.raw_data.ref_block_hash).toBeDefined()
  expect(tx.raw_data.expiration).toBeDefined()
  expect(tx.raw_data.timestamp).toBe(Number(blockTimestamp))
})

test('permissionId is baked in as Permission_id and changes the id', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildSendTrc10(client, {
    to,
    assetName: '1002000',
    amount: 1000n,
    permissionId: 2,
  })
  const contract = (tx.raw_data.contract as Record<string, unknown>[])[0] as {
    Permission_id?: number
  }

  // TRON renders the field with a capital `P`.
  expect(contract.Permission_id).toBe(2)
  // The permission id is part of the serialized bytes → a different txID.
  expect(tx.txID).not.toBe(utf8Form?.txID)
  expect(tx.raw_data_hex).not.toBe(utf8Form?.rawDataHex)
})

test('accepts the hex asset_name form and yields the identical bytes', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildSendTrc10(client, {
    to,
    assetName: '0x31303032303030',
    amount: 1000n,
  })

  expect(tx.txID).toBe(hexForm?.txID)
  expect(tx.raw_data_hex).toBe(hexForm?.rawDataHex)
})

test('refuses an odd-nibble hex asset_name instead of padding it into another asset', async () => {
  const { transport, calls } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  // The hex form above with its last nibble lost. Left-padded it would be
  // signed as `03 13 03 03 03 23 03 03` — a different asset id entirely.
  await expect(
    buildSendTrc10(client, {
      to,
      assetName: '0x3130303230303',
      amount: 1000n,
    }),
  ).rejects.toThrow(InvalidHexValueError)
  expect(calls).toHaveLength(0)
})

test('throws AccountNotFoundError when no account is available (bare action)', async () => {
  const { transport } = buildMock()
  const client = createPublicClient({ transport })
  await expect(
    buildSendTrc10(client, { to, assetName: '1002000', amount: 1n }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
