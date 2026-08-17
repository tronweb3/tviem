import { expect, test } from 'vitest'

import { buildCreateProposal } from '../../../src/actions/wallet/createProposal.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { makeTviemClient, tviemHeader } from './_buildTestHelpers.js'

test('builds ProposalCreateContract offline', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildCreateProposal({
    parameters: [{ key: 9, value: 1 }],
    blockHeader: tviemHeader,
  })

  expect(tviemTx.visible).toBe(false)
  expect(tviemTx.signature).toBeUndefined()
})

test('permissionId is baked in as Permission_id', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildCreateProposal({
    parameters: [{ key: 9, value: 1 }],
    permissionId: 2,
    blockHeader: tviemHeader,
  })

  const contract = (
    tviemTx.raw_data.contract as Record<string, unknown>[]
  )[0] as {
    Permission_id?: number
  }
  expect(contract.Permission_id).toBe(2)
})

// A proto3 map keeps only the LAST entry for a repeated key, so a duplicate
// would silently drop the earlier value on-chain while the txID still commits
// to both entries. Refuse before building.
test('rejects duplicate parameter keys before any request', async () => {
  const client = makeTviemClient()

  await expect(
    client.buildCreateProposal({
      parameters: [
        { key: 9, value: 1 },
        { key: 9, value: 2 },
      ],
      blockHeader: tviemHeader,
    }),
  ).rejects.toThrow(/Duplicate proposal parameter key/)
})

test('rejects duplicate parameter keys mixing number and bigint', async () => {
  const client = makeTviemClient()

  await expect(
    client.buildCreateProposal({
      parameters: [
        { key: 9, value: 1 },
        { key: 9n, value: 2 },
      ],
      blockHeader: tviemHeader,
    }),
  ).rejects.toThrow(/Duplicate proposal parameter key/)
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    buildCreateProposal(client, {
      parameters: [{ key: 9, value: 1 }],
      blockHeader: tviemHeader,
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
