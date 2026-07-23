import { expect, test } from 'vitest'

import { buildUpdateToken } from '../../../src/actions/wallet/updateToken.js'
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

const omniParams = {
  description: 'An updated token',
  url: 'https://new.example.com',
  newLimit: 1000n,
  newPublicLimit: 100n,
} as const

const twOptions = {
  description: 'An updated token',
  url: 'https://new.example.com',
  freeBandwidth: 1000,
  freeBandwidthLimit: 100,
}

test('builds UpdateAssetContract byte-identical to TronWeb', async () => {
  const client = makeOmniClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const omniTx = await client.buildUpdateToken({
    ...omniParams,
    blockHeader: omniHeader,
  })
  const twTx = await tronWeb.transactionBuilder.updateToken(
    { ...twOptions, blockHeader: twBlockHeader },
    owner,
  )

  expect(omniTx.visible).toBe(false)
  expect(omniTx.signature).toBeUndefined()
  expectBuildMatchesTronweb(omniTx, twTx, 'updateToken')
})

test('permissionId is baked in as Permission_id and matches TronWeb', async () => {
  const client = makeOmniClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const omniTx = await client.buildUpdateToken({
    ...omniParams,
    permissionId: 2,
    blockHeader: omniHeader,
  })
  const twTx = await tronWeb.transactionBuilder.updateToken(
    { ...twOptions, permissionId: 2, blockHeader: twBlockHeader },
    owner,
  )

  const contract = (
    omniTx.raw_data.contract as Record<string, unknown>[]
  )[0] as {
    Permission_id?: number
  }
  expect(contract.Permission_id).toBe(2)
  expectBuildMatchesTronweb(omniTx, twTx, 'updateToken+permissionId')
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    buildUpdateToken(client, { ...omniParams, blockHeader: omniHeader }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
