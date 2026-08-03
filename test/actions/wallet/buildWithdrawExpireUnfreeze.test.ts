import { expect, test } from 'vitest'
import { buildWithdrawExpireUnfreeze } from '../../../src/actions/wallet/withdrawExpireUnfreeze.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { rpc } from '../../fixtures/rpc/loader.js'
import { loadTxFixtureFile } from '../../fixtures/tx/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

// pk = 1 → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC (the fixture owner).
const pk1 = `0x${'0'.repeat(63)}1` as const

// Same gold vector as withdrawExpireUnfreeze — the build half must produce the
// identical bytes / id (it is exactly what withdrawExpireUnfreeze signs).
const [fixture] = loadTxFixtureFile('withdraw-expire-unfreeze-contract.json')

function buildMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasthex: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('builds the WithdrawExpireUnfreezeContract in TronWeb JSON shape, unsigned', async () => {
  const { transport, calls } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildWithdrawExpireUnfreeze(client, {})

  // Byte-identical to what withdrawExpireUnfreeze builds/signs.
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

  const tx = await buildWithdrawExpireUnfreeze(client, {
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

test('raw_data.contract[0].type is the node string WithdrawExpireUnfreezeContract', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildWithdrawExpireUnfreeze(client, {})
  const contract = (tx.raw_data.contract as Record<string, unknown>[])[0] as {
    type: string
    parameter: { type_url: string; value: Record<string, unknown> }
  }

  expect(contract.type).toBe('WithdrawExpireUnfreezeContract')
  expect(contract.parameter.type_url).toBe(
    'type.googleapis.com/protocol.WithdrawExpireUnfreezeContract',
  )
  // snake_case key, 41-hex owner address (no 0x).
  expect(contract.parameter.value.owner_address).toMatch(/^41[0-9a-f]{40}$/)
})

test('permissionId is baked in as Permission_id and changes the id', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildWithdrawExpireUnfreeze(client, { permissionId: 2 })
  const contract = (tx.raw_data.contract as Record<string, unknown>[])[0] as {
    Permission_id?: number
  }

  // TRON renders the field with a capital `P`.
  expect(contract.Permission_id).toBe(2)
  // The permission id is part of the serialized bytes → a different txID.
  expect(tx.txID).not.toBe(fixture?.txID)
  expect(tx.raw_data_hex).not.toBe(fixture?.rawDataHex)
})

test('throws AccountNotFoundError when no account is available (bare action)', async () => {
  const { transport } = buildMock()
  const client = createPublicClient({ transport })
  await expect(buildWithdrawExpireUnfreeze(client, {})).rejects.toBeInstanceOf(
    AccountNotFoundError,
  )
})
