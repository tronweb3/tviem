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

// The canonical entry order for this SDK's own builds lives HERE (the codec
// serializes the model as given): ascending by stringified key ("10" < "2"),
// independent of the caller's argument order — so the same parameters always
// yield the same bytes and txID.
test('built parameters are ordered by stringified key, whatever the input order', async () => {
  const client = makeTviemClient()
  const parametersOf = (tx: { raw_data: { contract: unknown[] } }) =>
    (
      tx.raw_data.contract[0] as {
        parameter: { value: { parameters: { key: number }[] } }
      }
    ).parameter.value.parameters.map((p) => p.key)

  const ascending = await client.buildCreateProposal({
    parameters: [
      { key: 2, value: 1 },
      { key: 10, value: 1 },
    ],
    blockHeader: tviemHeader,
  })
  const descending = await client.buildCreateProposal({
    parameters: [
      { key: 10, value: 1 },
      { key: 2, value: 1 },
    ],
    blockHeader: tviemHeader,
  })

  // "10" sorts before "2" lexicographically.
  expect(parametersOf(ascending)).toEqual([10, 2])
  expect(parametersOf(descending)).toEqual([10, 2])
  expect(descending.raw_data_hex).toBe(ascending.raw_data_hex)
  expect(descending.txID).toBe(ascending.txID)
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
