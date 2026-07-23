import { expect, test } from 'vitest'

import { buildExchangeCreate } from '../../../src/actions/wallet/exchangeCreate.js'
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

test('builds ExchangeCreateContract byte-identical to TronWeb', async () => {
  const client = makeOmniClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const omniTx = await client.buildExchangeCreate({
    firstTokenId: '1000001',
    firstTokenBalance: 1_000_000n,
    secondTokenId: '1000002',
    secondTokenBalance: 1_000_000n,
    blockHeader: omniHeader,
  })
  const twTx = await tronWeb.transactionBuilder.createTokenExchange(
    '1000001',
    1_000_000,
    '1000002',
    1_000_000,
    owner,
    { blockHeader: twBlockHeader },
  )

  expect(omniTx.visible).toBe(false)
  expect(omniTx.signature).toBeUndefined()
  expectBuildMatchesTronweb(omniTx, twTx, 'exchangeCreate')
})

test('permissionId is baked in as Permission_id and matches TronWeb', async () => {
  const client = makeOmniClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const omniTx = await client.buildExchangeCreate({
    firstTokenId: '1000001',
    firstTokenBalance: 1_000_000n,
    secondTokenId: '1000002',
    secondTokenBalance: 1_000_000n,
    permissionId: 2,
    blockHeader: omniHeader,
  })
  const twTx = await tronWeb.transactionBuilder.createTokenExchange(
    '1000001',
    1_000_000,
    '1000002',
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
  expectBuildMatchesTronweb(omniTx, twTx, 'exchangeCreate+permissionId')
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    buildExchangeCreate(client, {
      firstTokenId: '1000001',
      firstTokenBalance: 1_000_000n,
      secondTokenId: '1000002',
      secondTokenBalance: 1_000_000n,
      blockHeader: omniHeader,
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
