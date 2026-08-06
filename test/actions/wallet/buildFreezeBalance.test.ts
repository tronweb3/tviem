import { expect, test } from 'vitest'

import { buildFreezeBalance } from '../../../src/actions/wallet/freezeBalance.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { makeTviemClient, tviemHeader } from './_buildTestHelpers.js'

// A valid, distinct receiver (the USDT TRC20 contract address on mainnet).
const receiver = 'TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe'

test('builds FreezeBalanceContract offline', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildFreezeBalance({
    frozenBalance: 1_000_000n,
    frozenDuration: 3n,
    resource: 'ENERGY',
    receiverAddress: receiver,
    blockHeader: tviemHeader,
  })

  expect(tviemTx.visible).toBe(false)
  expect(tviemTx.signature).toBeUndefined()
})

test('permissionId is baked in as Permission_id', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildFreezeBalance({
    frozenBalance: 1_000_000n,
    frozenDuration: 3n,
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
    buildFreezeBalance(client, {
      frozenBalance: 1_000_000n,
      frozenDuration: 3n,
      resource: 'ENERGY',
      blockHeader: tviemHeader,
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
