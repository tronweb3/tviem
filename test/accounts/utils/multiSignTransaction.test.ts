import { expect, test } from 'vitest'
import type { SignableTransaction } from '../../../src/accounts/types.js'
import { multiSignTransaction } from '../../../src/accounts/utils/multiSignTransaction.js'
import { signTransaction } from '../../../src/accounts/utils/signTransaction.js'
import { decodeRawData } from '../../../src/utils/transaction/decodeRawData.js'
import type { RawData } from '../../../src/utils/transaction/serializeRawData.js'
import { loadTxFixtureFile } from '../../fixtures/tx/loader.js'

// pk=1 derives the fixture's owner_address (a permitted trivial key).
const pk1 = `0x${'0'.repeat(63)}1` as const

const [transfer] = loadTxFixtureFile('transfer-contract.json')

/** The fixture's full consistent triple (unbound bytes). */
function unboundTriple(): SignableTransaction {
  return {
    txID: transfer!.txID,
    raw_data: decodeRawData(transfer!.rawDataHex),
    raw_data_hex: transfer!.rawDataHex,
  }
}

/** The honest raw data with the transfer amount tampered (still valid). */
function tamperedRawData(): RawData {
  const raw = decodeRawData(transfer!.rawDataHex)
  const [first] = raw.contract
  return {
    ...raw,
    contract: [
      {
        ...first!,
        parameter: {
          ...first!.parameter,
          value: {
            ...(first!.parameter.value as Record<string, unknown>),
            amount: 999_999,
          } as never,
        },
      },
    ],
  }
}

test('defuses a getter that swaps raw_data between check and sign (TOCTOU)', () => {
  // multiSign recomputes the triple from raw_data before delegating to
  // signTransaction — so a getter showing txCheck an honest model and the
  // recompute a tampered one would yield a valid signature over bytes that
  // were never checked. The pre-check snapshot pins one single model.
  const honest = unboundTriple()
  const local = signTransaction({ transaction: honest, privateKey: pk1 })
  let reads = 0
  const evil = {
    txID: honest.txID,
    raw_data_hex: honest.raw_data_hex,
    get raw_data() {
      reads++
      return reads === 1 ? honest.raw_data : tamperedRawData()
    },
  } as unknown as SignableTransaction
  const signed = multiSignTransaction({ transaction: evil, privateKey: pk1 })
  expect(signed.txID).toBe(honest.txID)
  expect(signed.raw_data_hex).toBe(honest.raw_data_hex)
  expect(signed.signature).toEqual(local.signature)
})

test('returns a transaction sharing no references with the input', () => {
  const transaction = unboundTriple()
  const signed = multiSignTransaction({ transaction, privateKey: pk1 })
  expect(signed.raw_data).not.toBe(transaction.raw_data)
  expect(signed.raw_data).toEqual(transaction.raw_data)
  expect(signed.raw_data_hex).toBe(transaction.raw_data_hex)
})
