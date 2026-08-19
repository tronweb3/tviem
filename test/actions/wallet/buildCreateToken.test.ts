import { expect, test } from 'vitest'

import { buildCreateToken } from '../../../src/actions/wallet/createToken.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { IntegerOutOfRangeError } from '../../../src/errors/encoding.js'
import { AccountNotFoundError } from '../../../src/errors/rpc.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import { makeTviemClient, tviemHeader } from './_buildTestHelpers.js'

// ICO window must be in the future (TronWeb validates saleStart >= now).
const startTime = Date.now() + 3_600_000
const endTime = startTime + 3_600_000

const tviemToken = {
  name: 'MyToken',
  abbr: 'MTK',
  totalSupply: 1_000_000_000n,
  trxNum: 1,
  num: 1,
  precision: 6,
  startTime: BigInt(startTime),
  endTime: BigInt(endTime),
  description: 'A demo token',
  url: 'https://example.com',
  freeAssetNetLimit: 1000n,
  publicFreeAssetNetLimit: 100n,
  frozenSupply: [{ frozenAmount: 1000n, frozenDays: 2n }],
}

test('builds AssetIssueContract offline', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildCreateToken({
    ...tviemToken,
    blockHeader: tviemHeader,
  })

  expect(tviemTx.visible).toBe(false)
  expect(tviemTx.signature).toBeUndefined()
})

test('permissionId is baked in as Permission_id', async () => {
  const client = makeTviemClient()

  const tviemTx = await client.buildCreateToken({
    ...tviemToken,
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

test('refuses a trxNum past int32 instead of building a mispriced token', async () => {
  const client = makeTviemClient()

  // `trx_num` is int32. Left unbounded this builds and signs cleanly, and on
  // the byte-exact broadcast path java-tron reads back the low 32 bits —
  // 5_000_000_000 becomes 705_032_704 — AFTER the signature is verified,
  // because the contract body rides inside an `Any` (a bytes field) that
  // `Transaction.parseFrom` never parses. The token would go live priced ~7x
  // below intent, permanently: `trx_num` is immutable and an account may
  // issue only one asset.
  await expect(
    client.buildCreateToken({
      ...tviemToken,
      trxNum: 5_000_000_000,
      blockHeader: tviemHeader,
    }),
  ).rejects.toThrow(IntegerOutOfRangeError)

  // The largest legal value still builds.
  await expect(
    client.buildCreateToken({
      ...tviemToken,
      trxNum: 2147483647,
      blockHeader: tviemHeader,
    }),
  ).resolves.toBeDefined()
})

test('throws AccountNotFoundError when no account is available', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    buildCreateToken(client, { ...tviemToken, blockHeader: tviemHeader }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
