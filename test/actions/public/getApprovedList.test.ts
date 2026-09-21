import { expect, test } from 'vitest'
import { signTransaction } from '../../../src/accounts/utils/signTransaction.js'
import { getApprovedList } from '../../../src/actions/public/getApprovedList.js'
import { createPublicClient } from '../../../src/clients/createPublicClient.js'
import { TransactionTamperedError } from '../../../src/errors/rpc.js'
import { decodeRawData } from '../../../src/utils/transaction/decodeRawData.js'
import { getTransactionId } from '../../../src/utils/transaction/getTransactionId.js'
import { toRawDataHex } from '../../../src/utils/transaction/serializeRawData.js'
import { loadTxFixtureFile } from '../../fixtures/tx/loader.js'
import { createMockTransport } from '../../mock/createMockTransport.js'

const pk1 = `0x${'0'.repeat(63)}1` as const
const [transfer] = loadTxFixtureFile('transfer-contract.json')

// The fixture bytes with permission id 2 baked in — signTransaction never
// binds it itself, so the full consistent triple is built from the bound
// model before signing.
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

test('returns the approved list (Base58) and the LOCAL transaction', async () => {
  const { transport } = createMockTransport({
    responses: {
      getapprovedlist: {
        response: {
          result: { code: 'SUCCESS' },
          approved_list: ['TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'],
          transaction: {
            transaction: { txID: tx.txID, raw_data_hex: tx.raw_data_hex },
          },
        },
      },
    },
  })
  const client = createPublicClient({ transport })

  const result = await getApprovedList(client, { transaction: tx })
  expect(result.approvedList).toEqual(['TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'])
  // The local transaction, never the node's two-field echo — as the snapshot
  // the echo was checked against, not the caller's live object.
  expect(result.transaction).toEqual(tx)
  expect(result.transaction).not.toBe(tx)
})

test('throws TransactionTamperedError when the node echoes a different txID', async () => {
  const { transport } = createMockTransport({
    responses: {
      getapprovedlist: {
        response: {
          approved_list: [],
          transaction: {
            transaction: {
              txID: '00000000000000000000000000000000000000000000000000000000deadbeef',
              raw_data_hex: tx.raw_data_hex,
            },
          },
        },
      },
    },
  })
  const client = createPublicClient({ transport })
  await expect(
    getApprovedList(client, { transaction: tx }),
  ).rejects.toBeInstanceOf(TransactionTamperedError)
})

test('checks the echo against the transaction that was sent, not a later read of the caller object', async () => {
  // The caller's object changes while the request is in flight. The node is
  // honest — it echoes exactly the bytes it was sent — so this is not
  // tampering, and the transaction handed back is the one that was inspected.
  const local = { ...tx }
  const { transport } = createMockTransport({
    responses: {
      getapprovedlist: {
        fn: ({ body }) => {
          const sent = body as { txID: string; raw_data_hex: string }
          local.raw_data_hex = '0a02deadbeefcafe'
          return {
            approved_list: ['TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'],
            transaction: {
              transaction: { txID: sent.txID, raw_data_hex: sent.raw_data_hex },
            },
          }
        },
      },
    },
  })
  const client = createPublicClient({ transport })

  const result = await getApprovedList(client, { transaction: local })

  expect(result.approvedList).toEqual(['TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'])
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
      getapprovedlist: {
        fn: () => {
          local.raw_data_hex = forged
          return {
            approved_list: [],
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
    getApprovedList(client, { transaction: local }),
  ).rejects.toBeInstanceOf(TransactionTamperedError)
})
