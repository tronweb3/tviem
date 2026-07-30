import { expect, test } from 'vitest'

import { buildPurchaseToken } from '../../../src/actions/wallet/purchaseToken.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { makeTviemClient, tviemHeader } from './_buildTestHelpers.js'

// A valid, distinct issuer (the USDT TRC20 contract address on mainnet).
const issuer = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
const tokenId = '1000001'

test('builds ParticipateAssetIssueContract offline', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildPurchaseToken({
    issuerAddress: issuer,
    tokenId,
    amount: 1_000_000n,
    blockHeader: tviemHeader,
  })

  expect(tviemTx.visible).toBe(false)
  expect(tviemTx.signature).toBeUndefined()
})

test('permissionId is baked in as Permission_id', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildPurchaseToken({
    issuerAddress: issuer,
    tokenId,
    amount: 1_000_000n,
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
    buildPurchaseToken(client, {
      issuerAddress: issuer,
      tokenId,
      amount: 1_000_000n,
      blockHeader: tviemHeader,
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
