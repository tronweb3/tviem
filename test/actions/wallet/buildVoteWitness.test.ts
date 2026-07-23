import { expect, test } from 'vitest'
import { buildVoteWitness } from '../../../src/actions/wallet/voteWitness.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { createWalletClient } from '../../../src/clients/createWalletClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import type { Address } from '../../../src/types/address.js'
import { rpc } from '../../fixtures/rpc/loader.js'
import { loadTxFixtureFile } from '../../fixtures/tx/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

// pk = 1 (permitted trivial key) → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC,
// which is exactly the fixture `owner_address`.
const pk1 = `0x${'0'.repeat(63)}1` as const

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

// Same canonical vote gold vectors as voteWitness — the build half must produce
// the identical bytes / id (it is exactly what voteWitness signs).
const [twoVotes] = loadTxFixtureFile('vote-witness-contract.json')

function buildMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasthex: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('builds the canonical vote in TronWeb JSON shape, unsigned', async () => {
  const { transport, calls } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildVoteWitness(client, { votes })

  // Byte-identical to what voteWitness builds.
  expect(tx.txID).toBe(twoVotes?.txID)
  expect(tx.raw_data_hex).toBe(twoVotes?.rawDataHex)

  // TronWeb-compatible wrapper: visible:false, no signature (unsigned).
  expect(tx.visible).toBe(false)
  expect(tx.signature).toBeUndefined()

  // Only the block was fetched — nothing was signed or broadcast.
  expect(calls.map((c) => c.path)).toEqual(['getnowblock'])
})

test('a custom blockHeader is used verbatim and skips the getnowblock fetch', async () => {
  const { transport, calls } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildVoteWitness(client, {
    votes,
    blockHeader: {
      refBlockBytes: '1234',
      refBlockHash: '0102030405060708',
      timestamp: 1700000000000n,
      expiration: 1700000000000n + 60000n,
    },
  })

  expect(tx.txID).toBe(twoVotes?.txID)
  expect(tx.raw_data_hex).toBe(twoVotes?.rawDataHex)
  expect(calls).toEqual([])
})

test('raw_data.contract type is the java-tron node string', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildVoteWitness(client, { votes })
  const contract = (tx.raw_data.contract as Record<string, unknown>[])[0] as {
    type: string
  }

  expect(contract.type).toBe('VoteWitnessContract')
})

test('permissionId is baked in as Permission_id and changes the id', async () => {
  const { transport } = buildMock()
  const client = createWalletClient({ account: pk1, transport })

  const tx = await buildVoteWitness(client, { votes, permissionId: 2 })
  const contract = (tx.raw_data.contract as Record<string, unknown>[])[0] as {
    Permission_id?: number
  }

  // TRON renders the field with a capital `P`.
  expect(contract.Permission_id).toBe(2)
  // The permission id is part of the serialized bytes → a different txID.
  expect(tx.txID).not.toBe(twoVotes?.txID)
  expect(tx.raw_data_hex).not.toBe(twoVotes?.rawDataHex)
})

test('throws AccountNotFoundError when no account is available (bare action)', async () => {
  const { transport } = buildMock()
  const client = createPublicClient({ transport })
  await expect(buildVoteWitness(client, { votes })).rejects.toBeInstanceOf(
    AccountNotFoundError,
  )
})
