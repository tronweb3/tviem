import { expect, test } from 'vitest'
import { buildSendTrx } from '../../../src/actions/wallet/sendTrx.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import type { Address } from '../../../src/types/address.js'
import { rpc } from '../../fixtures/rpc/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

// pk = 1 (permitted trivial key) → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC.
const pk1 = `0x${'0'.repeat(63)}1` as const
const to = 'TPL66VK2gCXNCD7EJg9pgJRfqcRazjhUZY' as Address
// Chain time now comes from the pinned reference block, whose own timestamp is
// exactly this value (getnowblock.fixed), so the gold vectors are unchanged.
const blockTimestamp = 1700000000000n

// Same canonical transfer gold vectors as sendTrx — the build half must produce
// the identical bytes / id (it is exactly what sendTrx signs).
const TX_ID = '407ec75dad4545890e5788ef78555ecab9dc72d56df29da4ebbd508022bdbaba'
const RAW_DATA_HEX =
  '0a0212342208010203040506070840e0a499ffbc315a67080112630a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412320a15417e5f4552091a69125d5dfcb7b8c2659029395bdf121541928c9af0651632157ef27a2cf17ca72c575a4d2118c0843d7080d095ffbc31'

function buildMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasttransaction: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('builds the canonical transfer in TronWeb JSON shape, unsigned', async () => {
  const { transport, calls } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await client.buildSendTrx({ to, amount: 1000000n })

  // Byte-identical to what sendTrx builds.
  expect(tx.txID).toBe(TX_ID)
  expect(tx.raw_data_hex).toBe(RAW_DATA_HEX)

  // TronWeb-compatible wrapper: visible:false, no signature (unsigned).
  expect(tx.visible).toBe(false)
  expect(tx.signature).toBeUndefined()

  // Only the block was fetched — nothing was signed or broadcast.
  expect(calls.map((c) => c.path)).toEqual(['getnowblock'])
})

test('raw_data is java-tron node JSON (snake_case, 41-hex, string type)', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await client.buildSendTrx({ to, amount: 1000000n })
  const contract = (tx.raw_data.contract as Record<string, unknown>[])[0] as {
    type: string
    parameter: { type_url: string; value: Record<string, unknown> }
  }

  expect(contract.type).toBe('TransferContract')
  expect(contract.parameter.type_url).toBe(
    'type.googleapis.com/protocol.TransferContract',
  )
  // snake_case keys, 41-hex addresses (no 0x), int64 as a JSON number.
  expect(contract.parameter.value.owner_address).toMatch(/^41[0-9a-f]{40}$/)
  expect(contract.parameter.value.to_address).toMatch(/^41[0-9a-f]{40}$/)
  expect(contract.parameter.value.amount).toBe(1000000)
  // TaPoS + timing fields present.
  expect(tx.raw_data.ref_block_bytes).toBeDefined()
  expect(tx.raw_data.ref_block_hash).toBeDefined()
  expect(tx.raw_data.expiration).toBeDefined()
  expect(tx.raw_data.timestamp).toBe(Number(blockTimestamp))
})

test('a custom blockHeader is used verbatim and skips the getnowblock fetch', async () => {
  const { transport, calls } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  // The header matching the pinned reference block (same ref fields + chain
  // time the default path derives) must reproduce the exact gold vector...
  const tx = await client.buildSendTrx({
    to,
    amount: 1000000n,
    blockHeader: {
      ref_block_bytes: '1234',
      ref_block_hash: '0102030405060708',
      timestamp: blockTimestamp,
      expiration: blockTimestamp + 60000n,
    },
  })

  expect(tx.txID).toBe(TX_ID)
  expect(tx.raw_data_hex).toBe(RAW_DATA_HEX)
  expect(tx.raw_data.timestamp).toBe(Number(blockTimestamp))
  expect(tx.raw_data.expiration).toBe(Number(blockTimestamp + 60000n))
  // ...built fully offline: the node was never queried.
  expect(calls).toEqual([])
})

test('a custom blockHeader with different timing changes the built bytes', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await client.buildSendTrx({
    to,
    amount: 1000000n,
    blockHeader: {
      ref_block_bytes: '1234',
      ref_block_hash: '0102030405060708',
      timestamp: blockTimestamp + 1000n,
      expiration: blockTimestamp + 61000n,
    },
  })

  // Timing is part of the signed bytes, so a different header → a different id.
  expect(tx.raw_data.timestamp).toBe(Number(blockTimestamp + 1000n))
  expect(tx.txID).not.toBe(TX_ID)
  expect(tx.raw_data_hex).not.toBe(RAW_DATA_HEX)
})

test('permissionId is baked in as Permission_id and changes the id', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await client.buildSendTrx({
    to,
    amount: 1000000n,
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

test('writes a memo into raw_data.data', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await client.buildSendTrx({
    to,
    amount: 1000000n,
    memo: '0x6f6d6e69',
  })
  expect(tx.raw_data.data).toBe('6f6d6e69')
})

test('throws AccountNotFoundError when no account is available (bare action)', async () => {
  const { transport } = buildMock()
  const client = createPublicClient({ transport })
  await expect(
    buildSendTrx(client, { to, amount: 1000000n }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
