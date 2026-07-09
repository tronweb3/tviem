import { expect, test } from 'vitest'
import { rpc } from '../../../test/fixtures/rpc/loader.js'
import { createMockTransport } from '../../../test/mock/createMockTransport.js'
import { createPublicClient } from '../../clients/createPublicClient.js'
import { createWalletClient } from '../../clients/createWalletClient.js'
import { AccountNotFoundError } from '../../errors/rpc.js'
import type { Address } from '../../types/address.js'
import { sendTrx } from './sendTrx.js'

// pk = 1 (permitted trivial key) → address TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC.
const pk1 = `0x${'0'.repeat(63)}1` as const
const to = 'TPL66VK2gCXNCD7EJg9pgJRfqcRazjhUZY' as Address
const now = 1700000000000n

// Canonical transfer gold vectors (tx/transfer-contract[0] + sig/transaction[0]).
const TX_ID = '407ec75dad4545890e5788ef78555ecab9dc72d56df29da4ebbd508022bdbaba'
const RAW_DATA_HEX =
  '0a0212342208010203040506070840e0a499ffbc315a67080112630a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412320a15417e5f4552091a69125d5dfcb7b8c2659029395bdf121541928c9af0651632157ef27a2cf17ca72c575a4d2118c0843d7080d095ffbc31'
const SIG =
  '4d6f1e54ea593e5118c2d1b3701a4cab4d5235a418e9e46dba8c5f033bc4af0f6c04a08241de23936dffdedc869eac45533f9479a6bf372a38382b168b65ae001c'

function writeMock() {
  return createMockTransport({
    responses: {
      getnowblock: { response: rpc('getnowblock.fixed') },
      broadcasttransaction: { response: rpc('broadcasttransaction.ok') },
    },
  })
}

test('builds, signs and broadcasts the canonical transfer byte-for-byte', async () => {
  const { transport, calls, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })

  const { txID } = await client.sendTrx({ to, amount: 1000000n, now })

  // The returned id is the locally computed txID.
  expect(txID).toBe(TX_ID)

  // It fetched the latest block first (TaPoS), then broadcast.
  expect(calls.map((c) => c.path)).toEqual([
    'getnowblock',
    'broadcasttransaction',
  ])
  expect(calls[0]?.node).toBe('full')
  expect(calls[0]?.method).toBe('GET')
  expect(calls[1]?.node).toBe('full')
  expect(calls[1]?.method).toBe('POST')

  // The broadcast body is the whole signed transaction, byte-for-byte gold.
  const body = bodyOf('broadcasttransaction') as {
    txID: string
    raw_data: unknown
    raw_data_hex: string
    signature: string[]
  }
  expect(body.txID).toBe(TX_ID)
  expect(body.raw_data_hex).toBe(RAW_DATA_HEX)
  expect(body.signature).toEqual([SIG])
  expect(body.raw_data).toBeDefined()
})

test('returns the local txID even when the node echoes a different one', async () => {
  // broadcasttransaction.ok replies with an all-zero txid on purpose.
  const { transport } = writeMock()
  const client = createWalletClient({ account: pk1, transport })
  const { txID } = await client.sendTrx({ to, amount: 1000000n, now })
  expect(txID).toBe(TX_ID)
  expect(txID).not.toBe(`0${'0'.repeat(63)}`)
})

test('accepts a per-call account overriding the (absent) client account', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createWalletClient({ transport })
  const { txID } = await client.sendTrx({
    account: pk1,
    to,
    amount: 1000000n,
    now,
  })
  expect(txID).toBe(TX_ID)
  expect(
    (bodyOf('broadcasttransaction') as { raw_data_hex: string }).raw_data_hex,
  ).toBe(RAW_DATA_HEX)
})

test('writes a memo into raw_data.data', async () => {
  const { transport, bodyOf } = writeMock()
  const client = createWalletClient({ account: pk1, transport })
  await client.sendTrx({ to, amount: 1000000n, now, memo: '0x6f6d6e69' })
  const body = bodyOf('broadcasttransaction') as { raw_data: { data?: string } }
  expect(body.raw_data.data).toBe('6f6d6e69')
})

test('throws AccountNotFoundError when no account is available (bare action)', async () => {
  const { transport } = writeMock()
  const client = createPublicClient({ transport })
  await expect(
    sendTrx(client, { to, amount: 1000000n, now }),
  ).rejects.toBeInstanceOf(AccountNotFoundError)
})
