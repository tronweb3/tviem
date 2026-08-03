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
  expect(result.transaction).toBe(tx)
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
