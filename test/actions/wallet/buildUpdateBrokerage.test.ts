import { expect, test } from 'vitest'

import { buildUpdateBrokerage } from '../../../src/actions/wallet/updateBrokerage.js'
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

test('builds UpdateBrokerageContract byte-identical to TronWeb', async () => {
  const client = makeOmniClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const omniTx = await client.buildUpdateBrokerage({
    brokerage: 20,
    blockHeader: omniHeader,
  })
  const twTx = await tronWeb.transactionBuilder.updateBrokerage(20, owner, {
    blockHeader: twBlockHeader,
  })

  expect(omniTx.visible).toBe(false)
  expect(omniTx.signature).toBeUndefined()
  expectBuildMatchesTronweb(omniTx, twTx, 'updateBrokerage')
})

test('permissionId is baked in as Permission_id and matches TronWeb', async () => {
  const client = makeOmniClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const omniTx = await client.buildUpdateBrokerage({
    brokerage: 20,
    permissionId: 2,
    blockHeader: omniHeader,
  })
  const twTx = await tronWeb.transactionBuilder.updateBrokerage(20, owner, {
    permissionId: 2,
    blockHeader: twBlockHeader,
  })

  const contract = (
    omniTx.raw_data.contract as Record<string, unknown>[]
  )[0] as {
    Permission_id?: number
  }
  expect(contract.Permission_id).toBe(2)
  expectBuildMatchesTronweb(omniTx, twTx, 'updateBrokerage+permissionId')
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    buildUpdateBrokerage(client, { brokerage: 20, blockHeader: omniHeader }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
