import { expect, test } from 'vitest'

import { buildSetAccountId } from '../../../src/actions/wallet/setAccountId.js'
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

// A hex account id (8 bytes), the form TronWeb's `setAccountId` accepts.
const accountId = '0x6f6d6e69616161'

test('builds SetAccountIdContract byte-identical to TronWeb', async () => {
  const client = makeTviemClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const tviemTx = await client.buildSetAccountId({
    accountId,
    blockHeader: tviemHeader,
  })
  const twTx = await tronWeb.transactionBuilder.setAccountId(accountId, owner, {
    blockHeader: twBlockHeader,
  })

  expect(tviemTx.visible).toBe(false)
  expect(tviemTx.signature).toBeUndefined()
  expectBuildMatchesTronweb(tviemTx, twTx, 'setAccountId')
})

test('permissionId is baked in as Permission_id and matches TronWeb', async () => {
  const client = makeTviemClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const tviemTx = await client.buildSetAccountId({
    accountId,
    permissionId: 2,
    blockHeader: tviemHeader,
  })
  const twTx = await tronWeb.transactionBuilder.setAccountId(accountId, owner, {
    permissionId: 2,
    blockHeader: twBlockHeader,
  })

  const contract = (
    tviemTx.raw_data.contract as Record<string, unknown>[]
  )[0] as {
    Permission_id?: number
  }
  expect(contract.Permission_id).toBe(2)
  expectBuildMatchesTronweb(tviemTx, twTx, 'setAccountId+permissionId')
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    buildSetAccountId(client, { accountId, blockHeader: tviemHeader }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
