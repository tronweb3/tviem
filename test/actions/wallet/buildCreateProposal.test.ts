import { expect, test } from 'vitest'

import { buildCreateProposal } from '../../../src/actions/wallet/createProposal.js'
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

test('builds ProposalCreateContract byte-identical to TronWeb', async () => {
  const client = makeTviemClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const tviemTx = await client.buildCreateProposal({
    parameters: [{ key: 9, value: 1 }],
    blockHeader: tviemHeader,
  })
  const twTx = await tronWeb.transactionBuilder.createProposal(
    [{ key: 9, value: 1 }],
    owner,
    {
      blockHeader: twBlockHeader,
    },
  )

  expect(tviemTx.visible).toBe(false)
  expect(tviemTx.signature).toBeUndefined()
  expectBuildMatchesTronweb(tviemTx, twTx, 'createProposal')
})

test('accepts a Record<paramId, value> and matches TronWeb', async () => {
  const client = makeTviemClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const tviemTx = await client.buildCreateProposal({
    parameters: { 9: 1 },
    blockHeader: tviemHeader,
  })
  const twTx = await tronWeb.transactionBuilder.createProposal(
    [{ key: 9, value: 1 }],
    owner,
    {
      blockHeader: twBlockHeader,
    },
  )

  expectBuildMatchesTronweb(tviemTx, twTx, 'createProposal+record')
})

test('permissionId is baked in as Permission_id and matches TronWeb', async () => {
  const client = makeTviemClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const tviemTx = await client.buildCreateProposal({
    parameters: [{ key: 9, value: 1 }],
    permissionId: 2,
    blockHeader: tviemHeader,
  })
  const twTx = await tronWeb.transactionBuilder.createProposal(
    [{ key: 9, value: 1 }],
    owner,
    {
      permissionId: 2,
      blockHeader: twBlockHeader,
    },
  )

  const contract = (
    tviemTx.raw_data.contract as Record<string, unknown>[]
  )[0] as {
    Permission_id?: number
  }
  expect(contract.Permission_id).toBe(2)
  expectBuildMatchesTronweb(tviemTx, twTx, 'createProposal+permissionId')
})

test('multi-parameter proposal matches TronWeb regardless of caller order', async () => {
  const client = makeTviemClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  // Caller order [2, 10] must serialize in jspb stringified-key order [10, 2]
  // ("10" < "2"); a caller-order or numeric-order emit would diverge here.
  const params = [
    { key: 2, value: 1 },
    { key: 10, value: 1 },
  ]
  const tviemTx = await client.buildCreateProposal({
    parameters: params,
    blockHeader: tviemHeader,
  })
  const twTx = await tronWeb.transactionBuilder.createProposal(params, owner, {
    blockHeader: twBlockHeader,
  })
  expectBuildMatchesTronweb(tviemTx, twTx, 'createProposal+multiparam')
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    buildCreateProposal(client, {
      parameters: [{ key: 9, value: 1 }],
      blockHeader: tviemHeader,
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
