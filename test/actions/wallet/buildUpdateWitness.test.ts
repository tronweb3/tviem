import { expect, test } from 'vitest'

import { buildUpdateWitness } from '../../../src/actions/wallet/updateWitness.js'
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

const url = 'https://omni.example/new'

test('builds WitnessUpdateContract byte-identical to TronWeb', async () => {
  const client = makeTviemClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const tviemTx = await client.buildUpdateWitness({
    url,
    blockHeader: tviemHeader,
  })
  const twTx = await tronWeb.transactionBuilder.updateWitness(owner, url, {
    blockHeader: twBlockHeader,
  })

  expect(tviemTx.visible).toBe(false)
  expect(tviemTx.signature).toBeUndefined()
  expectBuildMatchesTronweb(tviemTx, twTx, 'updateWitness')
})

test('permissionId is baked in as Permission_id and matches TronWeb', async () => {
  const client = makeTviemClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const tviemTx = await client.buildUpdateWitness({
    url,
    permissionId: 2,
    blockHeader: tviemHeader,
  })
  const twTx = await tronWeb.transactionBuilder.updateWitness(owner, url, {
    permissionId: 2,
    blockHeader: twBlockHeader,
  })

  const contract = (
    tviemTx.raw_data.contract as Record<string, unknown>[]
  )[0] as {
    Permission_id?: number
  }
  expect(contract.Permission_id).toBe(2)
  expectBuildMatchesTronweb(tviemTx, twTx, 'updateWitness+permissionId')
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    buildUpdateWitness(client, { url, blockHeader: tviemHeader }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
