import { expect, test } from 'vitest'

import { buildExchangeCreate } from '../../../src/actions/wallet/exchangeCreate.js'
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

test('builds ExchangeCreateContract byte-identical to TronWeb', async () => {
  const client = makeTviemClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const tviemTx = await client.buildExchangeCreate({
    firstTokenId: '1000001',
    firstTokenBalance: 1_000_000n,
    secondTokenId: '1000002',
    secondTokenBalance: 1_000_000n,
    blockHeader: tviemHeader,
  })
  const twTx = await tronWeb.transactionBuilder.createTokenExchange(
    '1000001',
    1_000_000,
    '1000002',
    1_000_000,
    owner,
    { blockHeader: twBlockHeader },
  )

  expect(tviemTx.visible).toBe(false)
  expect(tviemTx.signature).toBeUndefined()
  expectBuildMatchesTronweb(tviemTx, twTx, 'exchangeCreate')
})

test('permissionId is baked in as Permission_id and matches TronWeb', async () => {
  const client = makeTviemClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const tviemTx = await client.buildExchangeCreate({
    firstTokenId: '1000001',
    firstTokenBalance: 1_000_000n,
    secondTokenId: '1000002',
    secondTokenBalance: 1_000_000n,
    permissionId: 2,
    blockHeader: tviemHeader,
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
    tviemTx.raw_data.contract as Record<string, unknown>[]
  )[0] as {
    Permission_id?: number
  }
  expect(contract.Permission_id).toBe(2)
  expectBuildMatchesTronweb(tviemTx, twTx, 'exchangeCreate+permissionId')
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
      blockHeader: tviemHeader,
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
