import { expect, test } from 'vitest'
import type { RawData } from '../../../src/utils/transaction/serializeRawData.js'
import { txCheck } from '../../../src/utils/transaction/txCheck.js'
import { loadTxFixtures } from '../../fixtures/tx/loader.js'

const canonical = loadTxFixtures().find(
  (f) => f.name === 'transfer canonical (reference vector)',
)!

/** The canonical fixture as a signable transaction (fresh deep copy). */
function canonicalTx() {
  return {
    txID: canonical.txID,
    raw_data: structuredClone(canonical.rawData) as RawData,
    raw_data_hex: canonical.rawDataHex,
  }
}

test('txCheck asserts its argument is a transaction object', () => {
  // JS callers still on the legacy (rawDataHex, txId) signature get a loud
  // migration error, not a silent false.
  expect(() => txCheck(canonical.rawDataHex as never)).toThrow(
    'txCheck expects a signable transaction object',
  )
  expect(() => txCheck(null as never)).toThrow(
    'txCheck expects a signable transaction object',
  )
  expect(() => txCheck(undefined as never)).toThrow(
    'txCheck expects a signable transaction object',
  )
})

test.each(
  loadTxFixtures(),
)('txCheck passes for gold vector: $name', (fixture) => {
  expect(
    txCheck({
      txID: fixture.txID,
      raw_data: fixture.rawData as RawData,
      raw_data_hex: fixture.rawDataHex,
    }),
  ).toBe(true)
})

test('txCheck accepts 0x-prefixed and uppercase raw_data_hex and txID', () => {
  const tx = canonicalTx()
  expect(
    txCheck({
      ...tx,
      txID: `0x${tx.txID.toUpperCase()}`,
      raw_data_hex: `0x${tx.raw_data_hex.toUpperCase()}`,
    }),
  ).toBe(true)
})

test('txCheck fails when raw_data disagrees with raw_data_hex', () => {
  const tx = canonicalTx()
  ;(tx.raw_data.contract[0]!.parameter.value as { amount: number }).amount = 2
  expect(txCheck(tx)).toBe(false)
})

test('txCheck fails when a raw_data_hex byte is flipped', () => {
  const tx = canonicalTx()
  const chars = tx.raw_data_hex.split('')
  // Flip one nibble inside the encoded amount (still valid hex, changes bytes).
  const i = chars.length - 2
  chars[i] = chars[i] === '0' ? '1' : '0'
  const tampered = chars.join('')
  expect(tampered).not.toBe(tx.raw_data_hex)
  expect(txCheck({ ...tx, raw_data_hex: tampered })).toBe(false)
})

test('txCheck fails when the txID does not match', () => {
  const tx = canonicalTx()
  const wrong = `${tx.txID.slice(0, -1)}${tx.txID.endsWith('0') ? '1' : '0'}`
  expect(txCheck({ ...tx, txID: wrong })).toBe(false)
})

test('txCheck fails when any of the three fields is missing', () => {
  const tx = canonicalTx()
  expect(txCheck({ ...tx, txID: undefined })).toBe(false)
  expect(txCheck({ ...tx, raw_data: undefined })).toBe(false)
  expect(txCheck({ ...tx, raw_data_hex: undefined })).toBe(false)
  expect(txCheck({})).toBe(false)
})

test('txCheck fails a wrong-length txID even when it prefix-matches', () => {
  const tx = canonicalTx()
  // A truncated txID that is a correct prefix of the real id must not pass.
  expect(txCheck({ ...tx, txID: tx.txID.slice(0, 32) })).toBe(false)
  // Nor a correct id with trailing hex appended.
  expect(txCheck({ ...tx, txID: `${tx.txID}ab` })).toBe(false)
})

test('txCheck fails a raw_data that serializes to zero bytes', () => {
  // A contract-less raw_data encodes to empty bytes — not a transaction.
  // Both faithful renderings of "empty" get the same verdict.
  const empty = { contract: [] }
  const sha256OfEmpty =
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  expect(
    txCheck({ txID: sha256OfEmpty, raw_data: empty, raw_data_hex: '0x' }),
  ).toBe(false)
  expect(
    txCheck({ txID: sha256OfEmpty, raw_data: empty, raw_data_hex: '' }),
  ).toBe(false)
})

test('txCheck ignores model content that never reaches the wire', () => {
  // The bytes are authoritative and are what a signature covers. Model
  // content the serializer never encodes cannot change the verdict:
  // a `__unknown` escape-hatch entry (only ever produced by decode) and a
  // proto3-default `Permission_id: 0` both leave the bytes untouched.
  const tx = canonicalTx()
  ;(
    tx.raw_data.contract[0]!.parameter.value as { __unknown?: unknown }
  ).__unknown = [{ fieldNo: 99, wireType: 0, value: 1n }]
  expect(txCheck(tx)).toBe(true)

  const withDefault = canonicalTx()
  withDefault.raw_data.contract[0]!.Permission_id = 0
  expect(txCheck(withDefault)).toBe(true)
})

test('txCheck returns false (does not throw) on structurally broken input', () => {
  const tx = canonicalTx()
  // Unknown key in raw_data: strict serialization refuses it.
  expect(
    txCheck({ ...tx, raw_data: { ...tx.raw_data, bogus: 1 } as RawData }),
  ).toBe(false)
  // Invalid raw_data model shape.
  expect(txCheck({ ...tx, raw_data: { contract: 'nope' } as never })).toBe(
    false,
  )
  // Invalid hex.
  expect(txCheck({ ...tx, raw_data_hex: 'zz' })).toBe(false)
})
