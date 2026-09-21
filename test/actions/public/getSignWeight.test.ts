import { expect, test } from 'vitest'
import type { SignableTransaction } from '../../../src/accounts/types.js'
import { signTransaction } from '../../../src/accounts/utils/signTransaction.js'
import { getSignWeight } from '../../../src/actions/public/getSignWeight.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { BaseError } from '../../../src/errors/base.js'
import { TransactionTamperedError } from '../../../src/errors/rpc.js'
import { decodeRawData } from '../../../src/utils/transaction/decodeRawData.js'
import { getTransactionId } from '../../../src/utils/transaction/getTransactionId.js'
import { toRawDataHex } from '../../../src/utils/transaction/serializeRawData.js'
import { loadTxFixtureFile } from '../../fixtures/tx/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

const pk1 = `0x${'0'.repeat(63)}1` as const
const [transfer] = loadTxFixtureFile('transfer-contract.json')

// A locally built, partially-signed multi-sig transaction (the fixture bytes
// with permission id 2 baked in — signTransaction never binds it itself, so
// the full consistent triple is built from the bound model before signing).
const baseRawData = decodeRawData(transfer!.rawDataHex)
const boundRawData = {
  ...baseRawData,
  contract: baseRawData.contract.map((contract) => ({
    ...contract,
    Permission_id: 2,
  })),
}
const tx = signTransaction({
  transaction: {
    txID: getTransactionId(boundRawData),
    raw_data: boundRawData,
    raw_data_hex: toRawDataHex(boundRawData),
  },
  privateKey: pk1,
})

const permission = {
  type: 'Active',
  id: 2,
  permission_name: 'active0',
  threshold: 2,
  operations:
    '7fff1fc0033e0300000000000000000000000000000000000000000000000000',
  keys: [
    { address: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC', weight: 1 },
    { address: 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K', weight: 1 },
  ],
}

test('returns weight/permission/approved + the LOCAL tx (recovering NOT_ENOUGH_PERMISSION)', async () => {
  const { transport, bodyOf } = createMockTransport({
    responses: {
      getsignweight: {
        // A `result: { code, message }` body is rejected by the generic
        // normalizer; getSignWeight recovers it (a normal collecting state).
        response: {
          result: { code: 'NOT_ENOUGH_PERMISSION', message: 'not enough' },
          permission,
          approved_list: ['TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'],
          current_weight: 1,
          transaction: {
            transaction: { txID: tx.txID, raw_data_hex: tx.raw_data_hex },
          },
        },
      },
    },
  })
  const client = createPublicClient({ transport })

  const result = await getSignWeight(client, { transaction: tx })

  expect(result.currentWeight).toBe(1n)
  expect(result.approvedList).toEqual(['TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'])
  expect(result.permission?.threshold).toBe(2n)
  expect(result.permission?.type).toBe(2)
  expect(result.permission?.operations).toBe(`0x${permission.operations}`)
  expect(result.permission?.keys).toEqual([
    { address: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC', weight: 1n },
    { address: 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K', weight: 1n },
  ])
  expect(result.result?.code).toBe('NOT_ENOUGH_PERMISSION')
  // The local transaction, never the node's two-field echo — as the snapshot
  // the echo was checked against, not the caller's live object.
  expect(result.transaction).toEqual(tx)
  expect(result.transaction).not.toBe(tx)
  expect(
    (bodyOf('getsignweight') as { raw_data_hex: string }).raw_data_hex,
  ).toBe(tx.raw_data_hex)
})

test('throws TransactionTamperedError when the node echoes different bytes', async () => {
  const { transport } = createMockTransport({
    responses: {
      getsignweight: {
        response: {
          permission,
          approved_list: [],
          current_weight: 0,
          transaction: {
            transaction: { txID: tx.txID, raw_data_hex: '0a02deadbeefcafe' },
          },
        },
      },
    },
  })
  const client = createPublicClient({ transport })
  await expect(
    getSignWeight(client, { transaction: tx }),
  ).rejects.toBeInstanceOf(TransactionTamperedError)
})

test('checks the echo against the transaction that was sent, not a later read of the caller object', async () => {
  // The caller's object changes while the request is in flight. The node is
  // honest — it echoes exactly the bytes it was sent — so this is not
  // tampering, and the transaction handed back is the one that was weighed.
  const local = { ...tx }
  const { transport } = createMockTransport({
    responses: {
      getsignweight: {
        fn: ({ body }) => {
          const sent = body as { txID: string; raw_data_hex: string }
          local.raw_data_hex = '0a02deadbeefcafe'
          return {
            permission,
            approved_list: ['TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'],
            current_weight: 1,
            transaction: {
              transaction: { txID: sent.txID, raw_data_hex: sent.raw_data_hex },
            },
          }
        },
      },
    },
  })
  const client = createPublicClient({ transport })

  const result = await getSignWeight(client, { transaction: local })

  expect(result.currentWeight).toBe(1n)
  expect(result.transaction.raw_data_hex).toBe(tx.raw_data_hex)
})

test('flags a tampered echo even when the caller object has changed to match it', async () => {
  // The reverse swap: the node echoes bytes it was never sent, and by the
  // time the response lands the caller's object reads as those same bytes. A
  // check against a fresh read would pass and bless the forged transaction.
  const forged = '0a02deadbeefcafe'
  const local = { ...tx }
  const { transport } = createMockTransport({
    responses: {
      getsignweight: {
        fn: () => {
          local.raw_data_hex = forged
          return {
            permission,
            approved_list: [],
            current_weight: 0,
            transaction: {
              transaction: { txID: tx.txID, raw_data_hex: forged },
            },
          }
        },
      },
    },
  })
  const client = createPublicClient({ transport })

  await expect(
    getSignWeight(client, { transaction: local }),
  ).rejects.toBeInstanceOf(TransactionTamperedError)
})

test('throws when the transaction has not been built (no raw_data_hex/txID)', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    getSignWeight(client, {
      transaction: { signature: [] } as unknown as SignableTransaction,
    }),
  ).rejects.toBeInstanceOf(BaseError)
})
