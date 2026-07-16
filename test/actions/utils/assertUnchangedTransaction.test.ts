import { expect, test } from 'vitest'
import type { SignableTransaction } from '../../../src/accounts/types.js'
import { TransactionTamperedError } from '../../../src/errors/rpc.js'
import { assertUnchangedTransaction } from '../../../src/actions/utils/assertUnchangedTransaction.js'

const local: SignableTransaction = {
  txID: 'aabbccdd',
  raw_data_hex: '0a02deadbeef',
}

test('a matching echoed transaction passes', () => {
  expect(() =>
    assertUnchangedTransaction(local, {
      txID: 'aabbccdd',
      raw_data_hex: '0a02deadbeef',
    }),
  ).not.toThrow()
})

test('matching is case-insensitive', () => {
  expect(() =>
    assertUnchangedTransaction(local, {
      txID: 'AABBCCDD',
      raw_data_hex: '0A02DEADBEEF',
    }),
  ).not.toThrow()
})

test('no echoed transaction is a no-op (nothing to adopt)', () => {
  expect(() => assertUnchangedTransaction(local, undefined)).not.toThrow()
})

test('a mismatched raw_data_hex throws (the load-bearing field)', () => {
  expect(() =>
    assertUnchangedTransaction(local, {
      txID: 'aabbccdd',
      raw_data_hex: '0a02cafe',
    }),
  ).toThrowError(TransactionTamperedError)
})

test('a mismatched txID throws', () => {
  expect(() =>
    assertUnchangedTransaction(local, {
      txID: 'ffffffff',
      raw_data_hex: '0a02deadbeef',
    }),
  ).toThrowError(TransactionTamperedError)
})
