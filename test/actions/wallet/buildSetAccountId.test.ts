import { expect, test } from 'vitest'

import { buildSetAccountId } from '../../../src/actions/wallet/setAccountId.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { makeTviemClient, tviemHeader } from './_buildTestHelpers.js'

// A hex account id (8 bytes), the form TronWeb's `setAccountId` accepts.
const accountId = '0x6f6d6e69616161'

test('builds SetAccountIdContract offline', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildSetAccountId({
    accountId,
    blockHeader: tviemHeader,
  })

  expect(tviemTx.visible).toBe(false)
  expect(tviemTx.signature).toBeUndefined()
})

test('permissionId is baked in as Permission_id', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildSetAccountId({
    accountId,
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
    buildSetAccountId(client, { accountId, blockHeader: tviemHeader }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
