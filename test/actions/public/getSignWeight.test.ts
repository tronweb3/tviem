import { expect, test } from 'vitest'
import { loadTxFixtureFile } from '../../fixtures/tx/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'
import type { SignableTransaction } from '../../../src/accounts/types.js'
import { signTransaction } from '../../../src/accounts/utils/signTransaction.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { BaseError } from '../../../src/errors/base.js'
import { TransactionTamperedError } from '../../../src/errors/rpc.js'
import { getSignWeight } from '../../../src/actions/public/getSignWeight.js'

const pk1 = `0x${'0'.repeat(63)}1` as const
const [transfer] = loadTxFixtureFile('transfer-contract.json')

// A locally built, partially-signed multi-sig transaction.
const tx = signTransaction({
  transaction: { raw_data_hex: transfer!.rawDataHex },
  privateKey: pk1,
  permissionId: 2,
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
  expect(result.transaction).toBe(tx) // the local object, never the node's
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

test('throws when the transaction has not been built (no raw_data_hex/txID)', async () => {
  const { transport } = createMockTransport({ responses: {} })
  const client = createPublicClient({ transport })
  await expect(
    getSignWeight(client, {
      transaction: { signature: [] } as SignableTransaction,
    }),
  ).rejects.toBeInstanceOf(BaseError)
})
