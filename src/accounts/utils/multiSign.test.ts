import { expect, test } from 'vitest'
import { loadTxFixtureFile } from '../../../test/fixtures/tx/loader.js'
import { BaseError } from '../../errors/base.js'
import type { SignableTransaction } from '../types.js'
import { multiSign } from './multiSign.js'

// Two distinct permitted trivial keys → two distinct co-signers.
const pk1 = `0x${'0'.repeat(63)}1` as const
const pk2 = `0x${'0'.repeat(63)}2` as const

// A valid serialized raw_data (canonical TRX transfer) to co-sign under a
// permission id. The owner_address guard is skipped in the permission path, so
// pk1/pk2 need not be the transfer's owner.
const [transfer] = loadTxFixtureFile('transfer-contract.json')
const base: SignableTransaction = { raw_data_hex: transfer!.rawDataHex }

test('signs under a permission id and bakes the id into the transaction', () => {
  const signed = multiSign({
    transaction: base,
    privateKey: pk1,
    permissionId: 2,
  })

  expect(signed.signature).toHaveLength(1)
  expect(signed.txID).toMatch(/^[0-9a-f]{64}$/)
  expect(signed.raw_data?.contract[0]?.permissionId).toBe(2)
  // The permission id is committed into the locally recomputed txID, so it
  // differs from the same raw_data signed without a permission id.
  expect(signed.txID).not.toBe(transfer?.txID)
})

test('accumulates signatures across parties without mutating the input', () => {
  const one = multiSign({ transaction: base, privateKey: pk1, permissionId: 2 })
  const two = multiSign({ transaction: one, privateKey: pk2, permissionId: 2 })

  expect(two.signature).toHaveLength(2)
  expect(two.signature?.[0]).toBe(one.signature?.[0]) // A's sig preserved
  expect(two.txID).toBe(one.txID) // same tx, more weight
  // Inputs untouched.
  expect(base.signature).toBeUndefined()
  expect(one.signature).toHaveLength(1)
})

test("does not append the same key's signature twice", () => {
  const one = multiSign({ transaction: base, privateKey: pk1, permissionId: 2 })
  const again = multiSign({
    transaction: one,
    privateKey: pk1,
    permissionId: 2,
  })
  expect(again.signature).toHaveLength(1)
})

test('rejects an invalid permission id', () => {
  expect(() =>
    multiSign({ transaction: base, privateKey: pk1, permissionId: -1 }),
  ).toThrowError(BaseError)
  expect(() =>
    multiSign({ transaction: base, privateKey: pk1, permissionId: 1.5 }),
  ).toThrowError(BaseError)
})
