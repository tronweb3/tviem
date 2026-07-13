import { expect, test } from 'vitest'
import { loadTxFixtureFile } from '../../../test/fixtures/tx/loader.js'
import { createMockTransport } from '../../../test/mock/createMockTransport.js'
import { signTransaction } from '../../accounts/utils/signTransaction.js'
import { createPublicClient } from '../../clients/createPublicClient.js'
import { TransactionTamperedError } from '../../errors/rpc.js'
import { getApprovedList } from './getApprovedList.js'

const pk1 = `0x${'0'.repeat(63)}1` as const
const [transfer] = loadTxFixtureFile('transfer-contract.json')

const tx = signTransaction({
  transaction: { raw_data_hex: transfer!.rawDataHex },
  privateKey: pk1,
  permissionId: 2,
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
