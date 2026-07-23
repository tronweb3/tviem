import { expect, test } from 'vitest'
import { delegateResource } from '../../../src/actions/wallet/delegateResource.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import type { Address } from '../../../src/types/address.js'
import { rpc } from '../../fixtures/rpc/loader.js'
import { loadTxFixtureFile } from '../../fixtures/tx/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { parseBroadcast } from '../../mock/parseBroadcast.js'

// pk = 1 (permitted trivial key) → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC,
// which is exactly the fixture `owner_address`.
const pk1 = `0x${'0'.repeat(63)}1` as const
const receiver = 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K' as Address

const [unlocked, locked] = loadTxFixtureFile('delegate-resource-contract.json')

function writeMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasthex: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('delegates BANDWIDTH (lock=false) byte-for-byte against the gold vector', async () => {
  const { transport, calls, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const { txID } = await delegateResource(client, {
    receiverAddress: receiver,
    balance: 1000000n,
    resource: 'BANDWIDTH',
    lock: false,
  })

  expect(txID).toBe(unlocked?.txID)
  expect(calls.map((c) => c.path)).toEqual(['getnowblock', 'broadcasthex'])

  const body = parseBroadcast(bodyOf('broadcasthex')) as {
    txID: string
    raw_data_hex: string
    signature: string[]
  }
  expect(body.txID).toBe(unlocked?.txID)
  expect(body.raw_data_hex).toBe(unlocked?.rawDataHex)
  expect(body.signature).toHaveLength(1)
  expect(body.signature[0]).toMatch(/^[0-9a-f]{130}$/)
})

test('delegates ENERGY with lock + lock_period byte-for-byte', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const { txID } = await delegateResource(client, {
    receiverAddress: receiver,
    balance: 2000000n,
    resource: 'ENERGY',
    lock: true,
    lockPeriod: 86400n,
  })

  expect(txID).toBe(locked?.txID)
  const body = parseBroadcast(bodyOf('broadcasthex')) as {
    raw_data_hex: string
  }
  expect(body.raw_data_hex).toBe(locked?.rawDataHex)
})

test('omitting lock matches the unlocked vector (lock=false is not encoded)', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const { txID } = await delegateResource(client, {
    receiverAddress: receiver,
    balance: 1000000n,
    resource: 'BANDWIDTH',
  })

  expect(txID).toBe(unlocked?.txID)
  expect(
    (parseBroadcast(bodyOf('broadcasthex')) as { raw_data_hex: string })
      .raw_data_hex,
  ).toBe(unlocked?.rawDataHex)
})

test('resolves the per-call account when the client hoists none', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createWalletClient({ transport })
  const { txID } = await delegateResource(client, {
    account: pk1,
    receiverAddress: receiver,
    balance: 1000000n,
    resource: 'BANDWIDTH',
    lock: false,
  })
  expect(txID).toBe(unlocked?.txID)
  expect(
    (parseBroadcast(bodyOf('broadcasthex')) as { raw_data_hex: string })
      .raw_data_hex,
  ).toBe(unlocked?.rawDataHex)
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = writeMock()
  const client = createPublicClient({ transport })
  await expect(
    delegateResource(client, {
      receiverAddress: receiver,
      balance: 1n,
      resource: 'BANDWIDTH',
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
