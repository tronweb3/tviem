import { expect, test } from 'vitest'
import { rpc } from '../../../test/fixtures/rpc/loader.js'
import { loadTxFixtureFile } from '../../../test/fixtures/tx/loader.js'
import { createMockTransport } from '../../../test/mock/createMockTransport.js'
import { parseBroadcast } from '../../../test/mock/parseBroadcast.js'
import { createPublicClient } from '../../clients/createPublicClient.js'
import { createWalletClient } from '../../clients/createWalletClient.js'
import { AccountNotFoundError } from '../../errors/rpc.js'
import type { Address } from '../../types/address.js'
import { voteWitness } from './voteWitness.js'

// pk = 1 (permitted trivial key) → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC,
// which is exactly the fixture `owner_address`.
const pk1 = `0x${'0'.repeat(63)}1` as const
const now = 1700000000000n

// The two witnesses (with vote counts) pinned by the gold vector.
const votes = [
  {
    voteAddress: 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K' as Address,
    voteCount: 5n,
  },
  {
    voteAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' as Address,
    voteCount: 10n,
  },
]

const [twoVotes] = loadTxFixtureFile('vote-witness-contract.json')

function writeMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasthex: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('votes for two witnesses byte-for-byte against the gold vector', async () => {
  const { transport, calls, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const { txID } = await voteWitness(client, { votes, now })

  expect(txID).toBe(twoVotes?.txID)
  expect(calls.map((c) => c.path)).toEqual(['getnowblock', 'broadcasthex'])

  const body = parseBroadcast(bodyOf('broadcasthex')) as {
    txID: string
    raw_data_hex: string
    signature: string[]
  }
  expect(body.txID).toBe(twoVotes?.txID)
  expect(body.raw_data_hex).toBe(twoVotes?.rawDataHex)
  expect(body.signature).toHaveLength(1)
  expect(body.signature[0]).toMatch(/^[0-9a-f]{130}$/)
})

test('resolves the per-call account when the client hoists none', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createWalletClient({ transport })
  const { txID } = await voteWitness(client, { account: pk1, votes, now })
  expect(txID).toBe(twoVotes?.txID)
  expect(
    (parseBroadcast(bodyOf('broadcasthex')) as { raw_data_hex: string })
      .raw_data_hex,
  ).toBe(twoVotes?.rawDataHex)
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = writeMock()
  const client = createPublicClient({ transport })
  await expect(voteWitness(client, { votes, now })).rejects.toBeInstanceOf(
    AccountNotFoundError,
  )
})
