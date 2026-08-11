import { expect, test } from 'vitest'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import {
  TransactionTamperedError,
  TronRpcError,
} from '../../../src/errors/rpc.js'
import { txCheck } from '../../../src/utils/transaction/txCheck.js'
import { rpc, rpcFixture } from '../../fixtures/rpc/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

const fixture = rpcFixture<
  { value: string },
  {
    ret: { contractRet: string }[]
    signature: string[]
    txID: string
    raw_data: unknown
    raw_data_hex: string
  }
>('gettransactionbyid')
const txID = fixture.response.txID

test('fetches a packed transaction and returns the verified triple', async () => {
  const { transport, calls, bodyOf } = createMockTransport({
    responses: { gettransactionbyid: { response: rpc('gettransactionbyid') } },
  })
  const client = createPublicClient({ transport })

  const transaction = await client.getTransaction({ hash: txID })
  expect(transaction).not.toBeNull()
  if (!transaction) throw new Error('expected transaction')

  expect(transaction.txID).toBe(txID)
  expect(transaction.raw_data_hex).toBe(fixture.response.raw_data_hex)
  expect(transaction.raw_data.ref_block_bytes).toBe('1234')
  expect(transaction.signature).toEqual(fixture.response.signature)
  expect(transaction.ret?.[0]?.contractRet).toBe('SUCCESS')

  // The result is signable downstream: the full triple is txCheck-consistent.
  expect(
    txCheck({
      txID: transaction.txID,
      raw_data: transaction.raw_data,
      raw_data_hex: transaction.raw_data_hex,
    }),
  ).toBe(true)

  // sent-right: full node, `value` body with the bare-hex id.
  expect(calls[0]?.node).toBe('full')
  expect(calls[0]?.path).toBe('gettransactionbyid')
  expect(calls[0]?.method).toBe('POST')
  expect(bodyOf('gettransactionbyid')).toEqual({ value: txID })
})

test('a 0x-prefixed hash is normalized to the bare-hex node dialect', async () => {
  const { transport, bodyOf } = createMockTransport({
    responses: { gettransactionbyid: { response: rpc('gettransactionbyid') } },
  })
  const client = createPublicClient({ transport })

  const transaction = await client.getTransaction({ hash: `0x${txID}` })
  expect(transaction?.txID).toBe(txID)
  expect(bodyOf('gettransactionbyid')).toEqual({ value: txID })
})

test('an unknown / not-yet-packed id resolves to null', async () => {
  const { transport } = createMockTransport({
    responses: { gettransactionbyid: { fn: () => ({}) } },
  })
  const client = createPublicClient({ transport })

  expect(await client.getTransaction({ hash: txID })).toBeNull()
})

test('a node returning different bytes than asked for throws TransactionTamperedError', async () => {
  // Perturb one byte of the returned raw_data_hex: the bytes no longer hash
  // to the requested id, so believing them would adopt a substituted payload.
  const substituted = rpc<{ raw_data_hex: string }>('gettransactionbyid')
  const otherHex = substituted.raw_data_hex.replace('5a67', '5a68')
  const { transport } = createMockTransport({
    responses: {
      gettransactionbyid: {
        fn: () => ({ ...substituted, raw_data_hex: otherHex, txID }),
      },
    },
  })
  const client = createPublicClient({ transport })

  await expect(client.getTransaction({ hash: txID })).rejects.toThrow(
    TransactionTamperedError,
  )
})

test('a node mislabeling correct bytes with a foreign txID throws TransactionTamperedError', async () => {
  const lying = {
    ...fixture.response,
    txID: '2e8b73373f830f8a100b11291c5e169a079552c212eb94b6c722247320adb698',
  }
  const { transport } = createMockTransport({
    responses: { gettransactionbyid: { fn: () => lying } },
  })
  const client = createPublicClient({ transport })

  await expect(client.getTransaction({ hash: txID })).rejects.toThrow(
    TransactionTamperedError,
  )
})

test('a lying raw_data JSON is never adopted — raw_data is decoded from the authenticated bytes', async () => {
  // The node returns the AUTHENTIC raw_data_hex (so the hash check passes)
  // but a raw_data JSON with a substituted recipient and amount. The result
  // must reflect the bytes, not the JSON.
  const lyingRawData = JSON.parse(
    JSON.stringify(fixture.response.raw_data),
  ) as {
    contract: {
      parameter: { value: { amount: number; to_address: string } }
    }[]
  }
  const contract = lyingRawData.contract[0]
  if (!contract) throw new Error('expected contract')
  contract.parameter.value.amount = 999999999
  contract.parameter.value.to_address =
    '410000000000000000000000000000000000000000'
  const { transport } = createMockTransport({
    responses: {
      gettransactionbyid: {
        fn: () => ({ ...fixture.response, raw_data: lyingRawData }),
      },
    },
  })
  const client = createPublicClient({ transport })

  const transaction = await client.getTransaction({ hash: txID })
  if (!transaction) throw new Error('expected transaction')
  const value = transaction.raw_data.contract[0]?.parameter.value as {
    amount: number
    to_address: string
  }
  expect(value.amount).toBe(1000000)
  expect(value.to_address).toBe('41928c9af0651632157ef27a2cf17ca72c575a4d21')
  expect(
    txCheck({
      txID: transaction.txID,
      raw_data: transaction.raw_data,
      raw_data_hex: transaction.raw_data_hex,
    }),
  ).toBe(true)
})

test('a non-hex raw_data_hex fails closed with the typed TronRpcError', async () => {
  const { transport } = createMockTransport({
    responses: {
      gettransactionbyid: {
        fn: () => ({ ...fixture.response, raw_data_hex: '0Xdeadbeef' }),
      },
    },
  })
  const client = createPublicClient({ transport })

  await expect(client.getTransaction({ hash: txID })).rejects.toThrow(
    TronRpcError,
  )
})

test('a malformed response (missing raw_data_hex) fails closed with TronRpcError', async () => {
  const { transport } = createMockTransport({
    responses: {
      gettransactionbyid: {
        fn: () => ({ txID, raw_data: fixture.response.raw_data }),
      },
    },
  })
  const client = createPublicClient({ transport })

  await expect(client.getTransaction({ hash: txID })).rejects.toThrow(
    TronRpcError,
  )
})

test('confirmed: true reads the transaction from the SolidityNode', async () => {
  const { transport, calls } = createMockTransport({
    responses: { gettransactionbyid: { response: rpc('gettransactionbyid') } },
  })
  const client = createPublicClient({ transport })

  await client.getTransaction({ hash: txID, confirmed: true })
  expect(calls[0]?.node).toBe('solidity')
})
