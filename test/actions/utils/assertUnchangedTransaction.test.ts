import { expect, test } from 'vitest'
import type { SignableTransaction } from '../../../src/accounts/types.js'
import { assertUnchangedTransaction } from '../../../src/actions/utils/assertUnchangedTransaction.js'
import { TransactionTamperedError } from '../../../src/errors/rpc.js'

// The comparison covers only `txID` and `raw_data_hex` — the `raw_data`
// model is present to satisfy the full-triple `SignableTransaction` shape.
const local: SignableTransaction = {
  txID: 'aabbccdd',
  raw_data: { contract: [] },
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

// `txCheck` — and so every signing path — accepts `txID` / `raw_data_hex` bare
// or `0x`-prefixed, and hands the caller's spelling back. An honest node echoes
// its own bare rendering of the same bytes; spelling is not tampering.
test('matching ignores a `0x` prefix, on either side', () => {
  expect(() =>
    assertUnchangedTransaction(
      { ...local, txID: '0xAABBCCDD', raw_data_hex: '0x0A02DEADBEEF' },
      { txID: 'aabbccdd', raw_data_hex: '0a02deadbeef' },
    ),
  ).not.toThrow()
  expect(() =>
    assertUnchangedTransaction(local, {
      txID: '0xaabbccdd',
      raw_data_hex: '0x0a02deadbeef',
    }),
  ).not.toThrow()
})

test('a `0x`-prefixed local transaction still flags different bytes', () => {
  const prefixed = {
    ...local,
    txID: '0xaabbccdd',
    raw_data_hex: '0x0a02deadbeef',
  }
  expect(() =>
    assertUnchangedTransaction(prefixed, {
      txID: 'aabbccdd',
      raw_data_hex: '0a02cafe',
    }),
  ).toThrowError(TransactionTamperedError)
  expect(() =>
    assertUnchangedTransaction(prefixed, {
      txID: 'ffffffff',
      raw_data_hex: '0a02deadbeef',
    }),
  ).toThrowError(TransactionTamperedError)
})

test('an echoed field that is not a string is a mismatch, not a raw TypeError', () => {
  expect(() =>
    assertUnchangedTransaction(local, {
      txID: 'aabbccdd',
      raw_data_hex: 0x0a02 as unknown as string,
    }),
  ).toThrowError(TransactionTamperedError)
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
