import { expect, test } from 'vitest'
import { freezeBalanceV2 } from '../../../src/actions/wallet/freezeBalanceV2.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { rpc } from '../../fixtures/rpc/loader.js'
import { loadTxFixtureFile } from '../../fixtures/tx/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { parseBroadcast } from '../../mock/parseBroadcast.js'

// pk = 1 (permitted trivial key) → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC,
// which is exactly the fixture `owner_address`.
const pk1 = `0x${'0'.repeat(63)}1` as const

const [bandwidth, energy] = loadTxFixtureFile('freeze-balance-v2-contract.json')

function writeMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasttransaction: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('freezes for BANDWIDTH byte-for-byte against the gold vector', async () => {
  const { transport, calls, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const { txID } = await freezeBalanceV2(client, {
    frozenBalance: 1000000n,
    resource: 'BANDWIDTH',
  })

  expect(txID).toBe(bandwidth?.txID)
  expect(calls.map((c) => c.path)).toEqual([
    'getnowblock',
    'broadcasttransaction',
  ])

  const body = parseBroadcast(bodyOf('broadcasttransaction')) as {
    txID: string
    raw_data_hex: string
    signature: string[]
  }
  expect(body.txID).toBe(bandwidth?.txID)
  expect(body.raw_data_hex).toBe(bandwidth?.rawDataHex)
  // owner = pk1, so a single valid signature is appended.
  expect(body.signature).toHaveLength(1)
  expect(body.signature[0]).toMatch(/^[0-9a-f]{130}$/)
})

test('freezes for ENERGY byte-for-byte against the gold vector', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const { txID } = await freezeBalanceV2(client, {
    frozenBalance: 2000000n,
    resource: 'ENERGY',
  })

  expect(txID).toBe(energy?.txID)
  const body = parseBroadcast(bodyOf('broadcasttransaction')) as {
    raw_data_hex: string
  }
  expect(body.raw_data_hex).toBe(energy?.rawDataHex)
})

// Spread check: the memo option must work uniformly on non-transfer actions
// (raw_data.data is a Transaction-level field, valid for every contract type).
test('memo lands in raw_data.data on a staking action', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  await client.freezeBalanceV2({
    frozenBalance: 500000n,
    resource: 'BANDWIDTH',
    memo: '0x6d656d6f',
  })

  const body = parseBroadcast(bodyOf('broadcasttransaction')) as {
    raw_data: { data?: string }
  }
  expect(body.raw_data.data).toBe('6d656d6f')
})

test('resolves the per-call account when the client hoists none', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createWalletClient({ transport })
  const { txID } = await freezeBalanceV2(client, {
    account: pk1,
    frozenBalance: 1000000n,
    resource: 'BANDWIDTH',
  })
  expect(txID).toBe(bandwidth?.txID)
  expect(
    (parseBroadcast(bodyOf('broadcasttransaction')) as { raw_data_hex: string })
      .raw_data_hex,
  ).toBe(bandwidth?.rawDataHex)
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = writeMock()
  const client = createPublicClient({ transport })
  await expect(
    freezeBalanceV2(client, { frozenBalance: 1n, resource: 'BANDWIDTH' }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
