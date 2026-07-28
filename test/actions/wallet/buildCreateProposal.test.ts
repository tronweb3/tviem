import { expect, test } from 'vitest'

import { buildCreateProposal } from '../../../src/actions/wallet/createProposal.js'
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

test('builds ProposalCreateContract byte-identical to TronWeb', async () => {
  const client = makeOmniClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const omniTx = await client.buildCreateProposal({
    parameters: [{ key: 9, value: 1 }],
    blockHeader: omniHeader,
  })
  const twTx = await tronWeb.transactionBuilder.createProposal(
    [{ key: 9, value: 1 }],
    owner,
    {
      blockHeader: twBlockHeader,
    },
  )

  expect(omniTx.visible).toBe(false)
  expect(omniTx.signature).toBeUndefined()
  expectBuildMatchesTronweb(omniTx, twTx, 'createProposal')
})

test('accepts a Record<paramId, value> and matches TronWeb', async () => {
  const client = makeOmniClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const omniTx = await client.buildCreateProposal({
    parameters: { 9: 1 },
    blockHeader: omniHeader,
  })
  const twTx = await tronWeb.transactionBuilder.createProposal(
    [{ key: 9, value: 1 }],
    owner,
    {
      blockHeader: twBlockHeader,
    },
  )

  expectBuildMatchesTronweb(omniTx, twTx, 'createProposal+record')
})

test('permissionId is baked in as Permission_id and matches TronWeb', async () => {
  const client = makeOmniClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const omniTx = await client.buildCreateProposal({
    parameters: [{ key: 9, value: 1 }],
    permissionId: 2,
    blockHeader: omniHeader,
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
    omniTx.raw_data.contract as Record<string, unknown>[]
  )[0] as {
    Permission_id?: number
  }
  expect(contract.Permission_id).toBe(2)
  expectBuildMatchesTronweb(omniTx, twTx, 'createProposal+permissionId')
})

test('multi-parameter proposal matches TronWeb regardless of caller order', async () => {
  const client = makeOmniClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  // Caller order [2, 10] must serialize in jspb stringified-key order [10, 2]
  // ("10" < "2"); a caller-order or numeric-order emit would diverge here.
  const params = [
    { key: 2, value: 1 },
    { key: 10, value: 1 },
  ]
  const omniTx = await client.buildCreateProposal({
    parameters: params,
    blockHeader: omniHeader,
  })
  const twTx = await tronWeb.transactionBuilder.createProposal(params, owner, {
    blockHeader: twBlockHeader,
  })
  expectBuildMatchesTronweb(omniTx, twTx, 'createProposal+multiparam')
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    buildCreateProposal(client, {
      parameters: [{ key: 9, value: 1 }],
      blockHeader: omniHeader,
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
