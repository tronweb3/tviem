import { expect, test } from 'vitest'
import { rpc } from '../../../test/fixtures/rpc/loader.js'
import { loadTxFixtureFile } from '../../../test/fixtures/tx/loader.js'
import { createMockTransport } from '../../../test/mock/createMockTransport.js'
import { createPublicClient } from '../../clients/createPublicClient.js'
import { createWalletClient } from '../../clients/createWalletClient.js'
import { AccountNotFoundError } from '../../errors/rpc.js'
import { withdrawBalance } from './withdrawBalance.js'

// pk = 1 (permitted trivial key) → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC,
// which is exactly the fixture `owner_address`.
const pk1 = `0x${'0'.repeat(63)}1` as const
const now = 1700000000000n

const [withdraw] = loadTxFixtureFile('withdraw-balance-contract.json')

function writeMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasttransaction: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('withdraws rewards byte-for-byte against the gold vector', async () => {
  const { transport, calls, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const { txID } = await withdrawBalance(client, { now })

  expect(txID).toBe(withdraw?.txID)
  expect(calls.map((c) => c.path)).toEqual([
    'getnowblock',
    'broadcasttransaction',
  ])

  const body = bodyOf('broadcasttransaction') as {
    txID: string
    raw_data_hex: string
    signature: string[]
  }
  expect(body.txID).toBe(withdraw?.txID)
  expect(body.raw_data_hex).toBe(withdraw?.rawDataHex)
  expect(body.signature).toHaveLength(1)
  expect(body.signature[0]).toMatch(/^[0-9a-f]{130}$/)
})

test('resolves the per-call account when the client hoists none', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createWalletClient({ transport })
  const { txID } = await withdrawBalance(client, { account: pk1, now })
  expect(txID).toBe(withdraw?.txID)
  expect(
    (bodyOf('broadcasttransaction') as { raw_data_hex: string }).raw_data_hex,
  ).toBe(withdraw?.rawDataHex)
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = writeMock()
  const client = createPublicClient({ transport })
  await expect(withdrawBalance(client, { now })).rejects.toBeInstanceOf(
    AccountNotFoundError,
  )
})
