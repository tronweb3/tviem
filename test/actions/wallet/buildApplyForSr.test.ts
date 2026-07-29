import { expect, test } from 'vitest'

import { buildApplyForSr } from '../../../src/actions/wallet/applyForSr.js'
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

const url = 'https://omni.example'

test('builds WitnessCreateContract byte-identical to TronWeb', async () => {
  const client = makeTviemClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const tviemTx = await client.buildApplyForSr({
    url,
    blockHeader: tviemHeader,
  })
  const twTx = await tronWeb.transactionBuilder.applyForSR(owner, url, {
    blockHeader: twBlockHeader,
  })

  expect(tviemTx.visible).toBe(false)
  expect(tviemTx.signature).toBeUndefined()
  expectBuildMatchesTronweb(tviemTx, twTx, 'applyForSr')
})

test('permissionId is baked in as Permission_id and matches TronWeb', async () => {
  const client = makeTviemClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const tviemTx = await client.buildApplyForSr({
    url,
    permissionId: 2,
    blockHeader: tviemHeader,
  })
  const twTx = await tronWeb.transactionBuilder.applyForSR(owner, url, {
    permissionId: 2,
    blockHeader: twBlockHeader,
  })

  const contract = (
    tviemTx.raw_data.contract as Record<string, unknown>[]
  )[0] as {
    Permission_id?: number
  }
  expect(contract.Permission_id).toBe(2)
  expectBuildMatchesTronweb(tviemTx, twTx, 'applyForSr+permissionId')
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    buildApplyForSr(client, { url, blockHeader: tviemHeader }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
