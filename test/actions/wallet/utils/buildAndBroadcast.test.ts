import { expect, test } from 'vitest'
import { buildAndBroadcast } from '../../../../src/actions/wallet/utils/buildAndBroadcast.js'
import { createPublicClient } from '../../../../src/clients/createPublicClient.js'
import { parseAccount } from '../../../../src/types/account.js'
import { addressToHex } from '../../../../src/utils/address/addressToHex.js'
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
      broadcasttransaction: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

/** A `FreezeBalanceV2Contract` matching the BANDWIDTH gold vector. */
function freezeContract(): RawContract {
  const account = parseAccount(pk1)
  return {
    type: ContractType.FreezeBalanceV2Contract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}FreezeBalanceV2Contract`,
      value: {
        owner_address: addressToHex(account.address),
        frozen_balance: 1000000n,
      },
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
  expect(calls.map((c) => c.path)).toEqual([
    'getnowblock',
    'broadcasttransaction',
  ])
  expect(calls[0]?.method).toBe('GET')
  expect(calls[1]?.method).toBe('POST')

  const body = parseBroadcast(bodyOf('broadcasttransaction')) as {
    txID: string
    raw_data_hex: string
    raw_data: { fee_limit?: number | undefined }
    signature: string[]
  }
  expect(body.txID).toBe(bandwidth?.txID)
  expect(body.raw_data_hex).toBe(bandwidth?.rawDataHex)
  expect(body.signature).toHaveLength(1)
  // No feeLimit is set on the raw_data model when none was supplied.
  expect(body.raw_data.fee_limit).toBeUndefined()
})

test('passes the broadcast acknowledgement through alongside the local txID', async () => {
  const { transport } = createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasttransaction: {
        response: {
          result: true,
          code: 'SUCCESS',
          // "broadcast ok" — node message fields arrive hex-encoded.
          message: '62726f616463617374206f6b',
          txid: `0${'0'.repeat(63)}`,
        },
      },
    },
  })
  const client = createPublicClient({ transport })
  const account = parseAccount(pk1)

  const response = await buildAndBroadcast(client, {
    contract: freezeContract(),
    account,
  })

  // All acknowledgement fields ride along (`message` hex-decoded); the id is
  // returned once, under the model's `txID` spelling — the node's echoed
  // all-zero `txid` never leaks.
  expect(response).toEqual({
    txID: bandwidth?.txID,
    result: true,
    code: 'SUCCESS',
    message: 'broadcast ok',
  })
  expect(response).not.toHaveProperty('txid')
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

  const body = parseBroadcast(bodyOf('broadcasttransaction')) as {
    raw_data: { fee_limit?: number | undefined }
  }
  expect(body.raw_data.fee_limit).toBe(15000000)
})

test('derives timing from the latest block when blockHeader is omitted', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createPublicClient({ transport })
  const account = parseAccount(pk1)

  await buildAndBroadcast(client, { contract: freezeContract(), account })

  const body = parseBroadcast(bodyOf('broadcasttransaction')) as {
    raw_data: { timestamp: bigint }
  }
  // getnowblock.fixed pins block_header timestamp = 1700000000000; timing is
  // taken verbatim from the fetched block rather than a wall clock.
  expect(body.raw_data.timestamp).toBe(1700000000000)
})
