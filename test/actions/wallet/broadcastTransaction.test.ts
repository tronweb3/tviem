import { expect, test } from 'vitest'
import { broadcastTransaction } from '../../../src/actions/wallet/broadcastTransaction.js'
import { createClient } from '../../../src/clients/createClient.js'
import { BaseError } from '../../../src/errors/base.js'
import { TronBroadcastError } from '../../../src/errors/node.js'
import {
  TransactionExpiredError,
  TronRpcError,
} from '../../../src/errors/rpc.js'
import { decodeRawData } from '../../../src/utils/transaction/decodeRawData.js'
import { rpc } from '../../fixtures/rpc/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

const TX_ID = '407ec75dad4545890e5788ef78555ecab9dc72d56df29da4ebbd508022bdbaba'
const RAW_DATA_HEX =
  '0a0212342208010203040506070840e0a499ffbc315a67080112630a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412320a15417e5f4552091a69125d5dfcb7b8c2659029395bdf121541928c9af0651632157ef27a2cf17ca72c575a4d2118c0843d7080d095ffbc31'
const SIG =
  '4d6f1e54ea593e5118c2d1b3701a4cab4d5235a418e9e46dba8c5f033bc4af0f6c04a08241de23936dffdedc869eac45533f9479a6bf372a38382b168b65ae001c'

const signedTransaction = {
  txID: TX_ID,
  raw_data: decodeRawData(RAW_DATA_HEX),
  raw_data_hex: RAW_DATA_HEX,
  signature: [SIG],
}

test('POSTs the signed transaction JSON to broadcasttransaction and returns the LOCAL txID', async () => {
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
  expect(bodyOf('broadcasttransaction')).toEqual(signedTransaction)
})

test('throws TronRpcError when the transaction carries no signature', async () => {
  const { transport } = createMockTransport({
    responses: { broadcasttransaction: { response: { result: true } } },
  })
  const client = createClient({ transport })
  await expect(
    broadcastTransaction(client, {
      signedTransaction: { ...signedTransaction, signature: [] },
    }),
  ).rejects.toBeInstanceOf(TronRpcError)
})

// The node rebuilds the wire bytes from raw_data while the returned txid is
// the caller-supplied txID — a mismatched triple would broadcast real bytes
// yet report an id under which the transaction can never be found (and a
// caller polling that id would rebuild and re-send). Refuse before any request.
test('refuses a txID that does not hash from the raw_data bytes', async () => {
  const { transport, calls } = createMockTransport({
    responses: { broadcasttransaction: { response: { result: true } } },
  })
  const client = createClient({ transport })

  const err = (await broadcastTransaction(client, {
    signedTransaction: { ...signedTransaction, txID: 'ab'.repeat(32) },
  }).catch((e) => e)) as BaseError
  expect(err).toBeInstanceOf(BaseError)
  expect(err.message).toContain('integrity check (txCheck)')
  expect(calls).toHaveLength(0)
})

test('refuses a raw_data model that does not serialize to raw_data_hex', async () => {
  const { transport, calls } = createMockTransport({
    responses: { broadcasttransaction: { response: { result: true } } },
  })
  const client = createClient({ transport })

  const err = (await broadcastTransaction(client, {
    signedTransaction: {
      ...signedTransaction,
      // A drifted model: the bytes (and signature) say something else.
      raw_data: { ...signedTransaction.raw_data, fee_limit: 1_000_000n },
    },
  }).catch((e) => e)) as BaseError
  expect(err).toBeInstanceOf(BaseError)
  expect(err.message).toContain('integrity check (txCheck)')
  expect(calls).toHaveLength(0)
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

// A broadcast is sent exactly once, even under a retrying transport: re-sending
// a signed tx cannot help (the node dedupes by txID). A raw throw is a
// retryable transport error (→ UnknownNodeError), so a default client would
// attempt it 4×; broadcastTransaction pins retryCount:0 → a single attempt.
test('never retries the broadcast, even when the transport retries', async () => {
  let attempts = 0
  const { transport } = createMockTransport({
    retryCount: 3,
    responses: {
      broadcasttransaction: {
        fn: () => {
          attempts += 1
          throw new Error('network boom')
        },
      },
    },
  })
  const client = createClient({ transport })
  await expect(
    broadcastTransaction(client, { signedTransaction }),
  ).rejects.toThrow()
  expect(attempts).toBe(1)
})
