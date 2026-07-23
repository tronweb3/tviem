import { expect, test } from 'vitest'

import { buildPurchaseToken } from '../../../src/actions/wallet/purchaseToken.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import {
  expectBuildMatchesTronweb,
  makeOmniClient,
  makeTronWeb,
  omniHeader,
  twBlockHeader,
} from './_tronwebDiff.js'

// A valid, distinct issuer (the USDT TRC20 contract address on mainnet).
const issuer = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
const tokenId = '1000001'

test('builds ParticipateAssetIssueContract byte-identical to TronWeb', async () => {
  const client = makeOmniClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const omniTx = await client.buildPurchaseToken({
    issuerAddress: issuer,
    tokenId,
    amount: 1_000_000n,
    blockHeader: omniHeader,
  })
  const twTx = await tronWeb.transactionBuilder.purchaseToken(
    issuer,
    tokenId,
    1_000_000,
    owner,
    { blockHeader: twBlockHeader },
  )

  expect(omniTx.visible).toBe(false)
  expect(omniTx.signature).toBeUndefined()
  expectBuildMatchesTronweb(omniTx, twTx, 'purchaseToken')
})

test('permissionId is baked in as Permission_id and matches TronWeb', async () => {
  const client = makeOmniClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const omniTx = await client.buildPurchaseToken({
    issuerAddress: issuer,
    tokenId,
    amount: 1_000_000n,
    permissionId: 2,
    blockHeader: omniHeader,
  })
  const twTx = await tronWeb.transactionBuilder.purchaseToken(
    issuer,
    tokenId,
    1_000_000,
    owner,
    { permissionId: 2, blockHeader: twBlockHeader },
  )

  const contract = (
    omniTx.raw_data.contract as Record<string, unknown>[]
  )[0] as {
    Permission_id?: number
  }
  expect(contract.Permission_id).toBe(2)
  expectBuildMatchesTronweb(omniTx, twTx, 'purchaseToken+permissionId')
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    buildPurchaseToken(client, {
      issuerAddress: issuer,
      tokenId,
      amount: 1_000_000n,
      blockHeader: omniHeader,
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
