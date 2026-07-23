import { expect, test } from 'vitest'

import { buildVoteProposal } from '../../../src/actions/wallet/voteProposal.js'
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

test('builds ProposalApproveContract byte-identical to TronWeb', async () => {
  const client = makeOmniClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const omniTx = await client.buildVoteProposal({
    proposalId: 1,
    isApproval: true,
    blockHeader: omniHeader,
  })
  const twTx = await tronWeb.transactionBuilder.voteProposal(1, true, owner, {
    blockHeader: twBlockHeader,
  })

  expect(omniTx.visible).toBe(false)
  expect(omniTx.signature).toBeUndefined()
  expectBuildMatchesTronweb(omniTx, twTx, 'voteProposal')
})

test('defaults to approval (isApproval true) and matches TronWeb', async () => {
  const client = makeOmniClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const omniTx = await client.buildVoteProposal({
    proposalId: 1,
    blockHeader: omniHeader,
  })
  const twTx = await tronWeb.transactionBuilder.voteProposal(1, true, owner, {
    blockHeader: twBlockHeader,
  })

  expectBuildMatchesTronweb(omniTx, twTx, 'voteProposal+default')
})

test('disapproval (isApproval false) matches TronWeb', async () => {
  const client = makeOmniClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const omniTx = await client.buildVoteProposal({
    proposalId: 1,
    isApproval: false,
    blockHeader: omniHeader,
  })
  const twTx = await tronWeb.transactionBuilder.voteProposal(1, false, owner, {
    blockHeader: twBlockHeader,
  })

  expectBuildMatchesTronweb(omniTx, twTx, 'voteProposal+disapprove')
})

test('permissionId is baked in as Permission_id and matches TronWeb', async () => {
  const client = makeOmniClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const omniTx = await client.buildVoteProposal({
    proposalId: 1,
    isApproval: true,
    permissionId: 2,
    blockHeader: omniHeader,
  })
  const twTx = await tronWeb.transactionBuilder.voteProposal(1, true, owner, {
    permissionId: 2,
    blockHeader: twBlockHeader,
  })

  const contract = (
    omniTx.raw_data.contract as Record<string, unknown>[]
  )[0] as {
    Permission_id?: number
  }
  expect(contract.Permission_id).toBe(2)
  expectBuildMatchesTronweb(omniTx, twTx, 'voteProposal+permissionId')
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    buildVoteProposal(client, { proposalId: 1, blockHeader: omniHeader }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
