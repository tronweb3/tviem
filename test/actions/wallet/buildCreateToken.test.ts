import { expect, test } from 'vitest'

import { buildCreateToken } from '../../../src/actions/wallet/createToken.js'
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

// ICO window must be in the future (TronWeb validates saleStart >= now).
const startTime = Date.now() + 3_600_000
const endTime = startTime + 3_600_000

const omniToken = {
  name: 'MyToken',
  abbr: 'MTK',
  totalSupply: 1_000_000_000n,
  trxNum: 1,
  num: 1,
  precision: 6,
  startTime: BigInt(startTime),
  endTime: BigInt(endTime),
  description: 'A demo token',
  url: 'https://example.com',
  freeAssetNetLimit: 1000n,
  publicFreeAssetNetLimit: 100n,
  frozenSupply: [{ frozenAmount: 1000n, frozenDays: 2n }],
}

const twOptions = {
  name: 'MyToken',
  abbreviation: 'MTK',
  totalSupply: 1_000_000_000,
  trxRatio: 1,
  tokenRatio: 1,
  saleStart: startTime,
  saleEnd: endTime,
  precision: 6,
  description: 'A demo token',
  url: 'https://example.com',
  freeBandwidth: 1000,
  freeBandwidthLimit: 100,
  frozenAmount: 1000,
  frozenDuration: 2,
}

test('builds AssetIssueContract byte-identical to TronWeb', async () => {
  const client = makeOmniClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const omniTx = await client.buildCreateToken({
    ...omniToken,
    blockHeader: omniHeader,
  })
  const twTx = await tronWeb.transactionBuilder.createToken(
    { ...twOptions, blockHeader: twBlockHeader },
    owner,
  )

  expect(omniTx.visible).toBe(false)
  expect(omniTx.signature).toBeUndefined()
  expectBuildMatchesTronweb(omniTx, twTx, 'createToken')
})

test('permissionId is baked in as Permission_id and matches TronWeb', async () => {
  const client = makeOmniClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const omniTx = await client.buildCreateToken({
    ...omniToken,
    permissionId: 2,
    blockHeader: omniHeader,
  })
  const twTx = await tronWeb.transactionBuilder.createToken(
    { ...twOptions, permissionId: 2, blockHeader: twBlockHeader },
    owner,
  )

  const contract = (
    omniTx.raw_data.contract as Record<string, unknown>[]
  )[0] as {
    Permission_id?: number
  }
  expect(contract.Permission_id).toBe(2)
  expectBuildMatchesTronweb(omniTx, twTx, 'createToken+permissionId')
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    buildCreateToken(client, { ...omniToken, blockHeader: omniHeader }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
