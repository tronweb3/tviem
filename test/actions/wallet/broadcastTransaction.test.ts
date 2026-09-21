import { expect, test } from 'vitest'
import { broadcastTransaction } from '../../../src/actions/wallet/broadcastTransaction.js'
import { createClient } from '../../../src/clients/createClient.js'
import { BaseError } from '../../../src/errors/base.js'
import { TronBroadcastError } from '../../../src/errors/node.js'
import {
  TransactionExpiredError,
  TronRpcError,
} from '../../../src/errors/rpc.js'
import type { TronHexAddress } from '../../../src/types/address.js'
import { toBase58 } from '../../../src/utils/address/toBase58.js'
import { hexToBytes } from '../../../src/utils/encoding/toBytes.js'
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

  const response = await broadcastTransaction(client, { signedTransaction })

  // broadcasttransaction.ok echoes an all-zero txid; the local id wins. The
  // node's other acknowledgement fields ride along, and the broadcast
  // transaction itself is returned.
  expect(response.txid).toBe(TX_ID)
  expect(response.txid).not.toBe(`0${'0'.repeat(63)}`)
  expect(response).toEqual({
    txid: TX_ID,
    result: true,
    transaction: signedTransaction,
  })

  expect(calls[0]?.node).toBe('full')
  expect(calls[0]?.path).toBe('broadcasttransaction')
  expect(calls[0]?.method).toBe('POST')
  expect(bodyOf('broadcasttransaction')).toEqual(signedTransaction)
})

test('passes the acknowledgement fields through (message hex-decoded), never the echoed txid', async () => {
  const { transport } = createMockTransport({
    responses: {
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
  const client = createClient({ transport })
  expect(await broadcastTransaction(client, { signedTransaction })).toEqual({
    txid: TX_ID,
    result: true,
    code: 'SUCCESS',
    message: 'broadcast ok',
    transaction: signedTransaction,
  })
})

test('returns the snapshot it broadcast, not the caller object', async () => {
  const { transport, bodyOf } = createMockTransport({
    responses: {
      broadcasttransaction: { response: rpc('broadcasttransaction.ok') },
    },
  })
  const client = createClient({ transport })

  // A caller object may carry extra properties; the returned transaction is
  // the four-field snapshot that was integrity-checked and actually sent.
  const decorated = { ...signedTransaction, visible: false }
  const response = await broadcastTransaction(client, {
    signedTransaction: decorated,
  })
  expect(response.transaction).toEqual(signedTransaction)
  expect(response.transaction).not.toHaveProperty('visible')
  expect(response.transaction).toEqual(bodyOf('broadcasttransaction'))
})

// txCheck runs the SDK's deliberately lenient serializer, so a model spelling
// its addresses any accepted way passes it byte-for-byte — but the node parses
// `raw_data` as `visible: false` JSON and reads only `41…` hex. What is relayed
// must be the canonical rendering of the checked bytes, never the caller's
// spelling of them.
const canonicalValue = signedTransaction.raw_data.contract[0]!.parameter
  .value as {
  owner_address: TronHexAddress
  to_address: TronHexAddress
  amount: number
}

function respell(value: Record<string, unknown>) {
  return {
    ...signedTransaction,
    raw_data: {
      ...signedTransaction.raw_data,
      contract: [
        {
          ...signedTransaction.raw_data.contract[0]!,
          parameter: {
            ...signedTransaction.raw_data.contract[0]!.parameter,
            value: { ...canonicalValue, ...value },
          },
        },
      ],
    },
  } as typeof signedTransaction
}

test.each([
  [
    'Base58 (a `visible: true` rendering)',
    {
      owner_address: toBase58(canonicalValue.owner_address),
      to_address: toBase58(canonicalValue.to_address),
    },
  ],
  [
    '0x EVM 20-byte',
    {
      owner_address: `0x${canonicalValue.owner_address.slice(2)}`,
      to_address: `0x${canonicalValue.to_address.slice(2)}`,
    },
  ],
  [
    'Uint8Array',
    {
      owner_address: hexToBytes(`0x${canonicalValue.owner_address}`),
      to_address: hexToBytes(`0x${canonicalValue.to_address}`),
    },
  ],
  ['bigint amount', { amount: BigInt(canonicalValue.amount) }],
])('relays the canonical node-JSON model for a %s spelling', async (_, value) => {
  const { transport, bodyOf } = createMockTransport({
    responses: {
      broadcasttransaction: { response: rpc('broadcasttransaction.ok') },
    },
  })
  const client = createClient({ transport })

  const response = await broadcastTransaction(client, {
    signedTransaction: respell(value),
  })

  // The same bytes, so the same transaction — sent in the one form the node
  // reads, and handed back as exactly what was sent.
  expect(bodyOf('broadcasttransaction')).toEqual(signedTransaction)
  expect(response.transaction).toEqual(signedTransaction)
  expect(response.txid).toBe(TX_ID)
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

test('the expiration remap keeps the node rejection as cause', async () => {
  const rejection = {
    result: false,
    code: 'TAPOS_ERROR',
    message: '5461706f7320636865636b206572726f722e',
    txid: TX_ID,
  }
  const { transport } = createMockTransport({
    responses: { broadcasttransaction: { error: rejection } },
  })
  const client = createClient({ transport })
  const err = (await broadcastTransaction(client, { signedTransaction }).catch(
    (e) => e,
  )) as TransactionExpiredError

  expect(err).toBeInstanceOf(TransactionExpiredError)
  // The raw node body stays reachable through the cause.
  const cause = err.cause as TronBroadcastError
  expect(cause).toBeInstanceOf(TronBroadcastError)
  expect(cause.code).toBe('TAPOS_ERROR')
  expect(cause.response).toEqual(rejection)
})

test('refuses an empty acknowledgement body instead of resolving', async () => {
  // An LB stub / warming node answers `{}` — neither `result: true` nor any
  // rejection shape. The transaction may never have reached a node, so this
  // must not resolve as a success carrying only the local txid.
  const { transport } = createMockTransport({
    responses: { broadcasttransaction: { response: {} } },
  })
  const client = createClient({ transport })
  await expect(
    broadcastTransaction(client, { signedTransaction }),
  ).rejects.toThrow('The node did not acknowledge the broadcast.')
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

test('defuses a nested getter that swaps the body after the integrity check', async () => {
  // The four-field pick alone leaves `raw_data` shared with the caller, so a
  // nested accessor could satisfy txCheck on one read and hand the request
  // body — which the node rebuilds the transaction from — a different value
  // on the next. The snapshot is deep, so the checked model IS the sent one.
  const honest = decodeRawData(RAW_DATA_HEX)
  const value = honest.contract[0]!.parameter.value as Record<string, unknown>
  const honestAmount = value.amount
  let reads = 0
  const evilValue = Object.defineProperty({ ...value }, 'amount', {
    enumerable: true,
    get() {
      reads++
      // reads 1-4 = the two txCheck traversals; read 5 = the request body.
      return reads <= 4 ? honestAmount : 1_000_000_000
    },
  })
  const evil = {
    txID: TX_ID,
    raw_data_hex: RAW_DATA_HEX,
    signature: [SIG],
    raw_data: {
      ...honest,
      contract: [
        {
          ...honest.contract[0]!,
          parameter: {
            ...honest.contract[0]!.parameter,
            value: evilValue,
          },
        },
      ],
    },
  }

  const { transport, bodyOf } = createMockTransport({
    responses: {
      broadcasttransaction: { response: rpc('broadcasttransaction.ok') },
    },
  })
  const client = createClient({ transport })

  const response = await broadcastTransaction(client, {
    signedTransaction: evil as typeof signedTransaction,
  })

  const sent = bodyOf('broadcasttransaction') as typeof signedTransaction
  expect(sent.raw_data.contract[0]!.parameter.value).toEqual(
    honest.contract[0]!.parameter.value,
  )
  expect(response.transaction.raw_data.contract[0]!.parameter.value).toEqual(
    honest.contract[0]!.parameter.value,
  )
  expect(response.txid).toBe(TX_ID)
})
