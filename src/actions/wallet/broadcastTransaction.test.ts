import { expect, test } from 'vitest'
import { rpc } from '../../../test/fixtures/rpc/loader.js'
import { createMockTransport } from '../../../test/mock/createMockTransport.js'
import { createClient } from '../../clients/createClient.js'
import { TronBroadcastError } from '../../errors/node.js'
import { TransactionExpiredError, TronRpcError } from '../../errors/rpc.js'
import { broadcastTransaction } from './broadcastTransaction.js'

const TX_ID = '407ec75dad4545890e5788ef78555ecab9dc72d56df29da4ebbd508022bdbaba'
const RAW_DATA_HEX =
  '0a0212342208010203040506070840e0a499ffbc315a67080112630a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412320a15417e5f4552091a69125d5dfcb7b8c2659029395bdf121541928c9af0651632157ef27a2cf17ca72c575a4d2118c0843d7080d095ffbc31'
const SIG =
  '4d6f1e54ea593e5118c2d1b3701a4cab4d5235a418e9e46dba8c5f033bc4af0f6c04a08241de23936dffdedc869eac45533f9479a6bf372a38382b168b65ae001c'

const signedTransaction = {
  txID: TX_ID,
  raw_data_hex: RAW_DATA_HEX,
  signature: [SIG],
}

test('POSTs the whole signed tx and returns the LOCAL txID (not the node echo)', async () => {
  const { transport, calls, bodyOf } = createMockTransport({
    responses: {
      broadcasttransaction: { response: rpc('broadcasttransaction.ok') },
    },
  })
  const client = createClient({ transport })

  const { txid } = await broadcastTransaction(client, { signedTransaction })

  // broadcasttransaction.ok echoes an all-zero txid; the local id wins.
  expect(txid).toBe(TX_ID)
  expect(txid).not.toBe(`0${'0'.repeat(63)}`)

  expect(calls[0]?.node).toBe('full')
  expect(calls[0]?.path).toBe('broadcasttransaction')
  expect(calls[0]?.method).toBe('POST')
  expect(bodyOf('broadcasttransaction')).toEqual({
    txID: TX_ID,
    raw_data: undefined,
    raw_data_hex: RAW_DATA_HEX,
    signature: [SIG],
  })
})

test('throws TronRpcError when the transaction carries no signature', async () => {
  const { transport } = createMockTransport({
    responses: { broadcasttransaction: { response: { result: true } } },
  })
  const client = createClient({ transport })
  await expect(
    broadcastTransaction(client, {
      signedTransaction: { txID: TX_ID, signature: [] },
    }),
  ).rejects.toBeInstanceOf(TronRpcError)
})

test('surfaces a broadcast rejection as TronBroadcastError with a decoded message', async () => {
  const { transport } = createMockTransport({
    responses: {
      broadcasttransaction: { error: rpc('errors/bandwidth-insufficient') },
    },
  })
  const client = createClient({ transport })
  const err = (await broadcastTransaction(client, { signedTransaction }).catch(
    (e) => e,
  )) as TronBroadcastError
  expect(err).toBeInstanceOf(TronBroadcastError)
  expect(err.shortMessage).toContain('Account resource insufficient error.')
})

test('maps an expiration rejection to TransactionExpiredError', async () => {
  const { transport } = createMockTransport({
    responses: {
      broadcasttransaction: {
        error: {
          result: false,
          code: 'TRANSACTION_EXPIRATION_ERROR',
          message: '5472616e73616374696f6e2065787069726564',
          txid: TX_ID,
        },
      },
    },
  })
  const client = createClient({ transport })
  await expect(
    broadcastTransaction(client, { signedTransaction }),
  ).rejects.toBeInstanceOf(TransactionExpiredError)
})

test('throws TronRpcError on a `{ result: false }` rejection without a code', async () => {
  const { transport } = createMockTransport({
    responses: { broadcasttransaction: { response: { result: false } } },
  })
  const client = createClient({ transport })
  await expect(
    broadcastTransaction(client, { signedTransaction }),
  ).rejects.toBeInstanceOf(TronRpcError)
})
