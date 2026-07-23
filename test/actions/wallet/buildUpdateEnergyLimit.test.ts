import { expect, test } from 'vitest'

import { buildUpdateEnergyLimit } from '../../../src/actions/wallet/updateEnergyLimit.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import type { Address } from '../../../src/types/address.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import {
  expectBuildMatchesTronweb,
  makeOmniClient,
  makeTronWeb,
  omniHeader,
  twBlockHeader,
} from './_tronwebDiff.js'

const contractAddress = 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K' as Address

test('builds UpdateEnergyLimitContract byte-identical to TronWeb', async () => {
  const client = makeOmniClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const omniTx = await client.buildUpdateEnergyLimit({
    contractAddress,
    originEnergyLimit: 5000000n,
    blockHeader: omniHeader,
  })
  const twTx = await tronWeb.transactionBuilder.updateEnergyLimit(
    contractAddress,
    5000000,
    owner,
    { blockHeader: twBlockHeader },
  )

  expect(omniTx.visible).toBe(false)
  expect(omniTx.signature).toBeUndefined()
  expectBuildMatchesTronweb(omniTx, twTx, 'updateEnergyLimit')
})

test('permissionId is baked in as Permission_id and matches TronWeb', async () => {
  const client = makeOmniClient()
  const tronWeb = makeTronWeb()
  const owner = tronWeb.defaultAddress.base58 as string

  const omniTx = await client.buildUpdateEnergyLimit({
    contractAddress,
    originEnergyLimit: 5000000n,
    permissionId: 2,
    blockHeader: omniHeader,
  })
  const twTx = await tronWeb.transactionBuilder.updateEnergyLimit(
    contractAddress,
    5000000,
    owner,
    { permissionId: 2, blockHeader: twBlockHeader },
  )

  const contract = (
    omniTx.raw_data.contract as Record<string, unknown>[]
  )[0] as {
    Permission_id?: number
  }
  expect(contract.Permission_id).toBe(2)
  expectBuildMatchesTronweb(omniTx, twTx, 'updateEnergyLimit+permissionId')
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    buildUpdateEnergyLimit(client, {
      contractAddress,
      originEnergyLimit: 5000000n,
      blockHeader: omniHeader,
    }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
