import { expect, test } from 'vitest'
import {
  type AccountPermissionUpdateParameters,
  accountPermissionUpdate,
  buildAccountPermissionUpdate,
} from '../../../src/actions/wallet/accountPermissionUpdate.js'
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

// A minimal valid permission set, cloned per test.
const key = {
  address: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC',
  weight: 1n,
} as const
const validOwner = () => ({ threshold: 1n, keys: [{ ...key }] })
const validActive = () => ({
  threshold: 1n,
  operations:
    '0x7fff1fc0033e0300000000000000000000000000000000000000000000000000',
  keys: [{ ...key }],
})

// A complete TaPoS header, so validation tests build fully offline — the
// mock transport has no responses, proving the guards fire before any
// node call.
const blockHeader = {
  ref_block_bytes: '1234',
  ref_block_hash: '0011223344556677',
  expiration: 1_600_000_060_000,
  timestamp: 1_600_000_000_000,
}

function offlineBuild(parameters: Record<string, unknown>) {
  const { transport } = createMockTransport({ responses: {} })
  const client = createWalletClient({ account: pk1, transport })
  return buildAccountPermissionUpdate(client, {
    ...parameters,
    blockHeader,
  } as unknown as AccountPermissionUpdateParameters)
}

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
  expect(calls.map((c) => c.path)).toEqual([
    'getnowblock',
    'broadcasttransaction',
  ])
  const body = parseBroadcast(bodyOf('broadcasttransaction')) as {
    raw_data_hex: string
  }
  expect(body.raw_data_hex).toBe(fixture?.rawDataHex)
})

// java-tron (AccountCapsule.updatePermissions) stores actives BY POSITION —
// actives[i] is written with id i+2 unconditionally, and the actuator never
// checks a provided id — so a caller-supplied id that differs from its slot is
// signed but never stored. `[{id:3},{id:2}]` would bind the first key set to
// id 2 and the second to id 3, the reverse of what the ids say. A provided id
// must equal its slot's i+2, else it is refused.
test('rejects an active permission id that does not match its position', async () => {
  await expect(
    offlineBuild({
      owner: validOwner(),
      actives: [{ ...validActive(), id: 5 }],
    }),
  ).rejects.toThrow('Invalid actives[0] permission: `id` must be 2')
})

test('rejects ids that would reorder the positional assignment', async () => {
  await expect(
    offlineBuild({
      owner: validOwner(),
      actives: [
        { ...validActive(), id: 3 },
        { ...validActive(), id: 2 },
      ],
    }),
  ).rejects.toThrow('Invalid actives[0] permission: `id` must be 2')
})

test('rejects a wrong id at a later active slot too', async () => {
  await expect(
    offlineBuild({
      owner: validOwner(),
      actives: [
        { ...validActive(), id: 2 },
        { ...validActive(), id: 2 },
      ],
    }),
  ).rejects.toThrow('Invalid actives[1] permission: `id` must be 3')
})

test('accepts an omitted id and a matching positional id alike', async () => {
  await expect(
    offlineBuild({ owner: validOwner(), actives: [validActive()] }),
  ).resolves.toBeDefined()
  await expect(
    offlineBuild({
      owner: validOwner(),
      actives: [{ ...validActive(), id: 2 }],
    }),
  ).resolves.toBeDefined()
  await expect(
    offlineBuild({
      owner: validOwner(),
      actives: [
        { ...validActive(), id: 2 },
        { ...validActive(), id: 3 },
      ],
    }),
  ).resolves.toBeDefined()
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = writeMock()
  const client = createPublicClient({ transport })
  await expect(
    accountPermissionUpdate(client, {
      owner: validOwner(),
      actives: [validActive()],
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})

test('builds a full owner + witness + actives set offline', async () => {
  const { txID } = await offlineBuild({
    owner: { permission_name: 'owner', ...validOwner() },
    witness: { permission_name: 'witness', ...validOwner() },
    actives: [{ permission_name: 'active0', ...validActive() }],
  })
  expect(txID).toMatch(/^[0-9a-f]{64}$/)
})

test('rejects a missing owner permission before any node call', async () => {
  await expect(offlineBuild({ actives: [validActive()] })).rejects.toThrow(
    'Missing owner permission',
  )
})

test('rejects missing actives before any node call', async () => {
  await expect(offlineBuild({ owner: validOwner() })).rejects.toThrow(
    'Missing active permissions',
  )
})

test('rejects an empty actives array', async () => {
  await expect(
    offlineBuild({ owner: validOwner(), actives: [] }),
  ).rejects.toThrow('Missing active permissions')
})

test('rejects a permission without threshold', async () => {
  await expect(
    offlineBuild({
      owner: { keys: [{ ...key }] },
      actives: [validActive()],
    }),
  ).rejects.toThrow('Invalid owner permission: missing `threshold`')
})

test('rejects a permission with no keys', async () => {
  await expect(
    offlineBuild({
      owner: { threshold: 1n, keys: [] },
      actives: [validActive()],
    }),
  ).rejects.toThrow('Invalid owner permission: `keys` must carry at least one')
})

test('rejects a witness permission with no keys', async () => {
  await expect(
    offlineBuild({
      owner: validOwner(),
      witness: { threshold: 1n, keys: [] },
      actives: [validActive()],
    }),
  ).rejects.toThrow(
    'Invalid witness permission: `keys` must carry at least one',
  )
})

test('rejects an active permission without operations', async () => {
  await expect(
    offlineBuild({
      owner: validOwner(),
      actives: [{ threshold: 1n, keys: [{ ...key }] }],
    }),
  ).rejects.toThrow('Invalid actives[0] permission: missing `operations`')
})

test('rejects an active operations bitmap that is not 32 bytes', async () => {
  await expect(
    offlineBuild({
      owner: validOwner(),
      actives: [{ ...validActive(), operations: '0xdeadbeef' }],
    }),
  ).rejects.toThrow(
    'Invalid actives[0] permission: `operations` must be a 32-byte bitmap',
  )
})

test('rejects an operations bitmap passed as a wrong-size Uint8Array', async () => {
  await expect(
    offlineBuild({
      owner: validOwner(),
      actives: [{ ...validActive(), operations: new Uint8Array(31) }],
    }),
  ).rejects.toThrow(
    'Invalid actives[0] permission: `operations` must be a 32-byte bitmap',
  )
})
