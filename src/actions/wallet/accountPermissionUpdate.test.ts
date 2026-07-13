import { expect, test } from 'vitest'
import { rpc } from '../../../test/fixtures/rpc/loader.js'
import { loadTxFixtureFile } from '../../../test/fixtures/tx/loader.js'
import { createMockTransport } from '../../../test/mock/createMockTransport.js'
import { createPublicClient } from '../../clients/createPublicClient.js'
import { createWalletClient } from '../../clients/createWalletClient.js'
import { AccountNotFoundError } from '../../errors/rpc.js'
import { accountPermissionUpdate } from './accountPermissionUpdate.js'

// pk = 1 (permitted trivial key) → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC,
// which is exactly the fixture `owner_address`.
const pk1 = `0x${'0'.repeat(63)}1` as const
const now = 1700000000000n

const [fixture] = loadTxFixtureFile('account-permission-update-contract.json')

function writeMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasttransaction: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('updates owner + active permissions byte-for-byte against the gold vector', async () => {
  const { transport, calls, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const { txID } = await accountPermissionUpdate(client, {
    owner: {
      permissionName: 'owner',
      threshold: 2n,
      keys: [
        { address: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC', weight: 1n },
        { address: 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K', weight: 1n },
      ],
    },
    actives: [
      {
        id: 2,
        permissionName: 'active0',
        threshold: 1n,
        operations:
          '0x7fff1fc0033e0300000000000000000000000000000000000000000000000000',
        keys: [{ address: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC', weight: 1n }],
      },
    ],
    now,
  })

  expect(txID).toBe(fixture?.txID)
  expect(calls.map((c) => c.path)).toEqual([
    'getnowblock',
    'broadcasttransaction',
  ])
  const body = bodyOf('broadcasttransaction') as { raw_data_hex: string }
  expect(body.raw_data_hex).toBe(fixture?.rawDataHex)
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = writeMock()
  const client = createPublicClient({ transport })
  await expect(
    accountPermissionUpdate(client, {
      actives: [{ threshold: 1n, keys: [] }],
      now,
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
