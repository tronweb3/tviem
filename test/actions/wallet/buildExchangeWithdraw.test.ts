import { expect, test } from 'vitest'

import { buildExchangeWithdraw } from '../../../src/actions/wallet/exchangeWithdraw.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { makeTviemClient, tviemHeader } from './_buildTestHelpers.js'

test('builds ExchangeWithdrawContract offline', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildExchangeWithdraw({
    exchangeId: 1,
    tokenId: '1000001',
    quant: 1_000_000n,
    blockHeader: tviemHeader,
  })

  expect(tviemTx.visible).toBe(false)
  expect(tviemTx.signature).toBeUndefined()
})

test('permissionId is baked in as Permission_id', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildExchangeWithdraw({
    exchangeId: 1,
    tokenId: '1000001',
    quant: 1_000_000n,
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
    buildExchangeWithdraw(client, {
      exchangeId: 1,
      tokenId: '1000001',
      quant: 1_000_000n,
      blockHeader: tviemHeader,
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
