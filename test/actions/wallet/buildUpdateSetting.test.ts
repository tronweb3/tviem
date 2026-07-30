import { expect, test } from 'vitest'

import { buildUpdateSetting } from '../../../src/actions/wallet/updateSetting.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import type { Address } from '../../../src/types/address.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { makeTviemClient, tviemHeader } from './_buildTestHelpers.js'

const contractAddress = 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K' as Address

test('builds UpdateSettingContract offline', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildUpdateSetting({
    contractAddress,
    consumeUserResourcePercent: 60n,
    blockHeader: tviemHeader,
  })

  expect(tviemTx.visible).toBe(false)
  expect(tviemTx.signature).toBeUndefined()
})

test('permissionId is baked in as Permission_id', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildUpdateSetting({
    contractAddress,
    consumeUserResourcePercent: 60n,
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
    buildUpdateSetting(client, {
      contractAddress,
      consumeUserResourcePercent: 60n,
      blockHeader: tviemHeader,
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
