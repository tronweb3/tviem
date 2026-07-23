import { expect, test } from 'vitest'
import { buildAndBroadcast } from '../../../../src/actions/wallet/utils/buildAndBroadcast.js'
import { createPublicClient } from '../../../../src/clients/createPublicClient.js'
import { parseAccount } from '../../../../src/types/account.js'
import { toHex } from '../../../../src/utils/address/toHex.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../../../src/utils/transaction/registry.js'
import type { RawContract } from '../../../../src/utils/transaction/serializeRawData.js'
import { rpc } from '../../../fixtures/rpc/loader.js'
import { loadTxFixtureFile } from '../../../fixtures/tx/loader.js'
import { createMockTransport } from '../../../mock/createMockTransport.js'
import { parseBroadcast } from '../../../mock/parseBroadcast.js'

// pk = 1 → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC (the fixture owner).
const pk1 = `0x${'0'.repeat(63)}1` as const

const [bandwidth] = loadTxFixtureFile('freeze-balance-v2-contract.json')

function writeMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasthex: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

/** A `FreezeBalanceV2Contract` matching the BANDWIDTH gold vector. */
function freezeContract(): RawContract {
  const account = parseAccount(pk1)
  return {
    type: ContractType.FreezeBalanceV2Contract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}FreezeBalanceV2Contract`,
      value: { ownerAddress: toHex(account.address), frozenBalance: 1000000n },
    },
  }
}

test('runs getNowBlock → sign → broadcast and returns the local txID', async () => {
  const { transport, calls, bodyOf } = writeMock()
  const client = createPublicClient({ transport })
  const account = parseAccount(pk1)

  const { txID } = await buildAndBroadcast(client, {
    contract: freezeContract(),
    account,
  })

  // Byte-for-byte gold: the helper produces the same bytes as the action.
  expect(txID).toBe(bandwidth?.txID)
  expect(calls.map((c) => c.path)).toEqual(['getnowblock', 'broadcasthex'])
  expect(calls[0]?.method).toBe('GET')
  expect(calls[1]?.method).toBe('POST')

  const body = parseBroadcast(bodyOf('broadcasthex')) as {
    txID: string
    raw_data_hex: string
    raw_data: { feeLimit?: bigint | undefined }
    signature: string[]
  }
  expect(body.txID).toBe(bandwidth?.txID)
  expect(body.raw_data_hex).toBe(bandwidth?.rawDataHex)
  expect(body.signature).toHaveLength(1)
  // No feeLimit is set on the raw_data model when none was supplied.
  expect(body.raw_data.feeLimit).toBeUndefined()
})

test('writes fee_limit into raw_data when supplied', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createPublicClient({ transport })
  const account = parseAccount(pk1)

  await buildAndBroadcast(client, {
    contract: freezeContract(),
    account,
    feeLimit: 15000000n,
  })

  const body = parseBroadcast(bodyOf('broadcasthex')) as {
    raw_data: { feeLimit?: bigint | undefined }
  }
  expect(body.raw_data.feeLimit).toBe(15000000n)
})

test('derives timing from the latest block when blockHeader is omitted', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createPublicClient({ transport })
  const account = parseAccount(pk1)

  await buildAndBroadcast(client, { contract: freezeContract(), account })

  const body = parseBroadcast(bodyOf('broadcasthex')) as {
    raw_data: { timestamp: bigint }
  }
  // getnowblock.fixed pins block_header timestamp = 1700000000000; timing is
  // taken verbatim from the fetched block rather than a wall clock.
  expect(body.raw_data.timestamp).toBe(1700000000000n)
})
