import { expect, test } from 'vitest'

import { buildUnfreezeBalance } from '../../../src/actions/wallet/unfreezeBalance.js'
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

// A valid, distinct receiver (the USDT TRC20 contract address on mainnet).
const receiver = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

test('builds UnfreezeBalanceContract byte-identical to TronWeb', async () => {
  const client = makeTviemClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const tviemTx = await client.buildUnfreezeBalance({
    resource: 'ENERGY',
    receiverAddress: receiver,
    blockHeader: tviemHeader,
  })
  const twTx = await tronWeb.transactionBuilder.unfreezeBalance(
    'ENERGY',
    owner,
    receiver,
    { blockHeader: twBlockHeader },
  )

  expect(tviemTx.visible).toBe(false)
  expect(tviemTx.signature).toBeUndefined()
  expectBuildMatchesTronweb(tviemTx, twTx, 'unfreezeBalance')
})

test('permissionId is baked in as Permission_id and matches TronWeb', async () => {
  const client = makeTviemClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const tviemTx = await client.buildUnfreezeBalance({
    resource: 'ENERGY',
    receiverAddress: receiver,
    permissionId: 2,
    blockHeader: tviemHeader,
  })
  const twTx = await tronWeb.transactionBuilder.unfreezeBalance(
    'ENERGY',
    owner,
    receiver,
    { permissionId: 2, blockHeader: twBlockHeader },
  )

  const contract = (
    tviemTx.raw_data.contract as Record<string, unknown>[]
  )[0] as {
    Permission_id?: number
  }
  expect(contract.Permission_id).toBe(2)
  expectBuildMatchesTronweb(tviemTx, twTx, 'unfreezeBalance+permissionId')
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    buildUnfreezeBalance(client, {
      resource: 'ENERGY',
      blockHeader: tviemHeader,
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
