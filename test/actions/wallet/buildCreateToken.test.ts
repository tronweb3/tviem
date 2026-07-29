import { expect, test } from 'vitest'

import { buildCreateToken } from '../../../src/actions/wallet/createToken.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import {
  expectBuildMatchesTronweb,
  makeTronWeb,
  makeTviemClient,
  tviemHeader,
  twBlockHeader,
} from './_tronwebDiff.js'

// ICO window must be in the future (TronWeb validates saleStart >= now).
const startTime = Date.now() + 3_600_000
const endTime = startTime + 3_600_000

const tviemToken = {
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
  const client = makeTviemClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const tviemTx = await client.buildCreateToken({
    ...tviemToken,
    blockHeader: tviemHeader,
  })
  const twTx = await tronWeb.transactionBuilder.createToken(
    { ...twOptions, blockHeader: twBlockHeader },
    owner,
  )

  expect(tviemTx.visible).toBe(false)
  expect(tviemTx.signature).toBeUndefined()
  expectBuildMatchesTronweb(tviemTx, twTx, 'createToken')
})

test('permissionId is baked in as Permission_id and matches TronWeb', async () => {
  const client = makeTviemClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const tviemTx = await client.buildCreateToken({
    ...tviemToken,
    permissionId: 2,
    blockHeader: tviemHeader,
  })
  const twTx = await tronWeb.transactionBuilder.createToken(
    { ...twOptions, permissionId: 2, blockHeader: twBlockHeader },
    owner,
  )

  const contract = (
    tviemTx.raw_data.contract as Record<string, unknown>[]
  )[0] as {
    Permission_id?: number
  }
  expect(contract.Permission_id).toBe(2)
  expectBuildMatchesTronweb(tviemTx, twTx, 'createToken+permissionId')
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    buildCreateToken(client, { ...tviemToken, blockHeader: tviemHeader }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
