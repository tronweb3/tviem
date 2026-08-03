import { expect, test } from 'vitest'
import { accountPermissionUpdate } from '../../../src/actions/wallet/accountPermissionUpdate.js'
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

const [fixture] = loadTxFixtureFile('account-permission-update-contract.json')

function writeMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasthex: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('updates owner + active permissions byte-for-byte against the gold vector', async () => {
  const { transport, calls, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const { txID } = await accountPermissionUpdate(client, {
    owner: {
      permission_name: 'owner',
      threshold: 2n,
      keys: [
        { address: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC', weight: 1n },
        { address: 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K', weight: 1n },
      ],
    },
    actives: [
      {
        id: 2,
        permission_name: 'active0',
        threshold: 1n,
        operations:
          '0x7fff1fc0033e0300000000000000000000000000000000000000000000000000',
        keys: [{ address: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC', weight: 1n }],
      },
    ],
  })

  expect(txID).toBe(fixture?.txID)
  expect(calls.map((c) => c.path)).toEqual(['getnowblock', 'broadcasthex'])
  const body = parseBroadcast(bodyOf('broadcasthex')) as {
    raw_data_hex: string
  }
  expect(body.raw_data_hex).toBe(fixture?.rawDataHex)
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = writeMock()
  const client = createPublicClient({ transport })
  await expect(
    accountPermissionUpdate(client, {
      actives: [{ threshold: 1n, keys: [] }],
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
