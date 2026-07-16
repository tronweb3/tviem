import { expect, test } from 'vitest'
import { rpc } from '../../fixtures/rpc/loader.js'
import { loadTxFixtureFile } from '../../fixtures/tx/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { parseBroadcast } from '../../mock/parseBroadcast.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { sendTrc10 } from '../../../src/actions/wallet/sendTrc10.js'

// pk = 1 (permitted trivial key) → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC,
// which is exactly the fixture `owner_address`.
const pk1 = `0x${'0'.repeat(63)}1` as const
const now = 1700000000000n

// The fixture pins two input forms (visible=true UTF-8 / visible=false hex),
// both of which normalize to the identical wire bytes / txID.
const [utf8Form, hexForm] = loadTxFixtureFile('transfer-asset-contract.json')

// Recipient decodes to 41-hex 412b5ad5c4795c026514f8317c7a215e218dccd6cf.
const to = 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K'

function writeMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasthex: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('sends a TRC10 asset byte-for-byte against the gold vector (UTF-8 asset_name)', async () => {
  const { transport, calls, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  // visible=true form: plain-text asset id, UTF-8 encoded.
  const { txID } = await sendTrc10(client, {
    to,
    assetName: '1002000',
    amount: 1000n,
    now,
  })

  expect(txID).toBe(utf8Form?.txID)
  expect(calls.map((c) => c.path)).toEqual(['getnowblock', 'broadcasthex'])

  const body = parseBroadcast(bodyOf('broadcasthex')) as {
    txID: string
    raw_data_hex: string
    signature: string[]
  }
  expect(body.txID).toBe(utf8Form?.txID)
  expect(body.raw_data_hex).toBe(utf8Form?.rawDataHex)
  // owner = pk1, so a single valid signature is appended.
  expect(body.signature).toHaveLength(1)
  expect(body.signature[0]).toMatch(/^[0-9a-f]{130}$/)
})

test('accepts the hex asset_name form and yields the identical bytes', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  // visible=false form: the same asset id supplied as 0x-hex.
  const { txID } = await sendTrc10(client, {
    to,
    assetName: '0x31303032303030',
    amount: 1000n,
    now,
  })

  expect(txID).toBe(hexForm?.txID)
  const body = parseBroadcast(bodyOf('broadcasthex')) as {
    raw_data_hex: string
  }
  expect(body.raw_data_hex).toBe(hexForm?.rawDataHex)
})

test('resolves the per-call account when the client hoists none', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createWalletClient({ transport })
  const { txID } = await sendTrc10(client, {
    account: pk1,
    to,
    assetName: '1002000',
    amount: 1000n,
    now,
  })
  expect(txID).toBe(utf8Form?.txID)
  expect(
    (parseBroadcast(bodyOf('broadcasthex')) as { raw_data_hex: string })
      .raw_data_hex,
  ).toBe(utf8Form?.rawDataHex)
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = writeMock()
  const client = createPublicClient({ transport })
  await expect(
    sendTrc10(client, { to, assetName: '1002000', amount: 1n, now }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
