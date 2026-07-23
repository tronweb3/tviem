import { expect, test } from 'vitest'
import { unfreezeBalanceV2 } from '../../../src/actions/wallet/unfreezeBalanceV2.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { rpc } from '../../fixtures/rpc/loader.js'
import { loadTxFixtureFile } from '../../fixtures/tx/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { parseBroadcast } from '../../mock/parseBroadcast.js'

// pk = 1 → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC (the fixture owner).
const pk1 = `0x${'0'.repeat(63)}1` as const

const [bandwidth, energy] = loadTxFixtureFile(
  'unfreeze-balance-v2-contract.json',
)

function writeMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasthex: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('unfreezes for BANDWIDTH byte-for-byte against the gold vector', async () => {
  const { transport, calls, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const { txID } = await unfreezeBalanceV2(client, {
    unfreezeBalance: 500000n,
    resource: 'BANDWIDTH',
  })

  expect(txID).toBe(bandwidth?.txID)
  expect(calls.map((c) => c.path)).toEqual(['getnowblock', 'broadcasthex'])

  const body = parseBroadcast(bodyOf('broadcasthex')) as {
    txID: string
    raw_data_hex: string
    signature: string[]
  }
  expect(body.txID).toBe(bandwidth?.txID)
  expect(body.raw_data_hex).toBe(bandwidth?.rawDataHex)
  expect(body.signature).toHaveLength(1)
  expect(body.signature[0]).toMatch(/^[0-9a-f]{130}$/)
})

test('unfreezes for ENERGY byte-for-byte against the gold vector', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const { txID } = await unfreezeBalanceV2(client, {
    unfreezeBalance: 250000n,
    resource: 'ENERGY',
  })

  expect(txID).toBe(energy?.txID)
  const body = parseBroadcast(bodyOf('broadcasthex')) as {
    raw_data_hex: string
  }
  expect(body.raw_data_hex).toBe(energy?.rawDataHex)
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = writeMock()
  const client = createPublicClient({ transport })
  await expect(
    unfreezeBalanceV2(client, {
      unfreezeBalance: 1n,
      resource: 'BANDWIDTH',
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
