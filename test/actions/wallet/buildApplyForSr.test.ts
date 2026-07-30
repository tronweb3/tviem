import { expect, test } from 'vitest'

import { buildApplyForSr } from '../../../src/actions/wallet/applyForSr.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { makeTviemClient, tviemHeader } from './_buildTestHelpers.js'

const url = 'https://node.example'

test('builds WitnessCreateContract offline', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildApplyForSr({
    url,
    blockHeader: tviemHeader,
  })

  expect(tviemTx.visible).toBe(false)
  expect(tviemTx.signature).toBeUndefined()
})

test('permissionId is baked in as Permission_id', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildApplyForSr({
    url,
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

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    buildApplyForSr(client, { url, blockHeader: tviemHeader }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
