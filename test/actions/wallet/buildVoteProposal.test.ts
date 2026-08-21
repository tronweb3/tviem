import { expect, test } from 'vitest'

import { buildVoteProposal } from '../../../src/actions/wallet/voteProposal.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { makeTviemClient, tviemHeader } from './_buildTestHelpers.js'

test('builds ProposalApproveContract offline', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildVoteProposal({
    proposalId: 1,
    isApproval: true,
    blockHeader: tviemHeader,
  })

  expect(tviemTx.visible).toBe(false)
  expect(tviemTx.signature).toBeUndefined()
})

test('permissionId is baked in as Permission_id', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildVoteProposal({
    proposalId: 1,
    isApproval: true,
    permissionId: 2,
    blockHeader: tviemHeader,
  })

  const contract = (
    tviemTx.raw_data.contract as Record<string, unknown>[]
  )[0] as {
    Permission_id?: number
  }
  expect(contract.Permission_id).toBe(2)
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    buildVoteProposal(client, {
      proposalId: 1,
      isApproval: true,
      blockHeader: tviemHeader,
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})

test('a stringly-typed isApproval is refused, not signed as approval', async () => {
  const client = makeTviemClient()

  // Untyped JS (or JSON/env config) hands over 'false'; Boolean('false') is
  // true, so without the codec guard this would SIGN an approval for a call
  // that spells revocation.
  await expect(
    client.buildVoteProposal({
      proposalId: 1n,
      isApproval: 'false' as never,
      blockHeader: tviemHeader,
    }),
  ).rejects.toThrow('Invalid is_add_approval: expected a boolean, got "false"')
})
