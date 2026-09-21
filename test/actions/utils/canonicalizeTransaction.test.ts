import { expect, test } from 'vitest'
import type { SignableTransaction } from '../../../src/accounts/types.js'
import { canonicalizeTransaction } from '../../../src/actions/utils/canonicalizeTransaction.js'
import { BaseError } from '../../../src/errors/base.js'
import type { TronHexAddress } from '../../../src/types/address.js'
import { toBase58 } from '../../../src/utils/address/toBase58.js'
import { decodeRawData } from '../../../src/utils/transaction/decodeRawData.js'
import { loadTxFixtureFile } from '../../fixtures/tx/loader.js'

const [transfer] = loadTxFixtureFile('transfer-contract.json')
const canonicalRawData = decodeRawData(transfer!.rawDataHex)
const canonical: SignableTransaction = {
  txID: transfer!.txID,
  raw_data: canonicalRawData,
  raw_data_hex: transfer!.rawDataHex,
  signature: ['ab'.repeat(65)],
}

// The same bytes, spelled the way java-tron renders them for `visible: true`.
const value = canonicalRawData.contract[0]!.parameter.value as {
  owner_address: TronHexAddress
  to_address: TronHexAddress
}
const visibleRawData = {
  ...canonicalRawData,
  contract: [
    {
      ...canonicalRawData.contract[0]!,
      parameter: {
        ...canonicalRawData.contract[0]!.parameter,
        value: {
          ...value,
          owner_address: toBase58(value.owner_address),
          to_address: toBase58(value.to_address),
        },
      },
    },
  ],
}

test('a canonical transaction comes back equal', () => {
  expect(canonicalizeTransaction(canonical)).toEqual(canonical)
})

test('re-derives raw_data from the checked bytes, keeping every other field', () => {
  expect(
    canonicalizeTransaction({ ...canonical, raw_data: visibleRawData }),
  ).toEqual(canonical)
})

test('pins a carried `visible` flag to false — the form the model is now in', () => {
  expect(
    canonicalizeTransaction({
      ...canonical,
      raw_data: visibleRawData,
      visible: true,
    } as SignableTransaction),
  ).toEqual({ ...canonical, visible: false })
})

test('does not invent a `visible` key the transaction never carried', () => {
  expect(
    canonicalizeTransaction({ ...canonical, raw_data: visibleRawData }),
  ).not.toHaveProperty('visible')
})

test('throws when the triple fails txCheck', () => {
  expect(() =>
    canonicalizeTransaction({ ...canonical, txID: 'ab'.repeat(32) }),
  ).toThrow(BaseError)
  expect(() =>
    canonicalizeTransaction({ ...canonical, txID: 'ab'.repeat(32) }),
  ).toThrow('integrity check (txCheck)')
})
