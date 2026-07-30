import { expect, test } from 'vitest'

import { buildUnfreezeBalance } from '../../../src/actions/wallet/unfreezeBalance.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { makeTviemClient, tviemHeader } from './_buildTestHelpers.js'

// A valid, distinct receiver (the USDT TRC20 contract address on mainnet).
const receiver = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

test('builds UnfreezeBalanceContract offline', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildUnfreezeBalance({
    resource: 'ENERGY',
    receiverAddress: receiver,
    blockHeader: tviemHeader,
  })

  expect(tviemTx.visible).toBe(false)
  expect(tviemTx.signature).toBeUndefined()
})

test('permissionId is baked in as Permission_id', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildUnfreezeBalance({
    resource: 'ENERGY',
    receiverAddress: receiver,
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
    buildUnfreezeBalance(client, {
      resource: 'ENERGY',
      blockHeader: tviemHeader,
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
