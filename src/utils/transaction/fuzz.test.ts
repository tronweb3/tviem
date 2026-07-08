import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

import { bytesToHex } from '../encoding/toHex.js'
import { decodeRawData } from './decodeRawData.js'
import { getTransactionId } from './getTransactionId.js'
import { serializeRawData } from './serializeRawData.js'
import { txCheck } from './txCheck.js'

/**
 * Differential fuzz corpus: 126 randomized cases across all 13 v0.1 contract
 * types, each carrying the gold-standard `rawDataHex` / `txID` produced by
 * TronWeb's official protobuf stack (see scripts/gen-tx-fuzz.mjs). Every case
 * is re-derived through our own codec and asserted byte-for-byte against the
 * gold vector — an end-to-end cross-check of our encode / decode / txID paths.
 */
type FuzzCase = {
  name: string
  contractType: number
  typeUrl: string
  rawDataHex: string
  txID: string
}

const cases = JSON.parse(
  readFileSync(
    new URL('../../../test/fixtures/tx/fuzz.json', import.meta.url),
    'utf8',
  ),
) as FuzzCase[]

test('fuzz corpus covers all 13 contract types with >=120 cases', () => {
  expect(cases.length).toBeGreaterThanOrEqual(120)
  expect(new Set(cases.map((c) => c.contractType)).size).toBe(13)
})

test.each(cases)('differential vs TronWeb gold: $name', (fixture) => {
  const model = decodeRawData(fixture.rawDataHex)

  // decode recovers the contract's type integer and Any type URL.
  expect(model.contract).toHaveLength(1)
  expect(model.contract[0]!.type).toBe(fixture.contractType)
  expect(model.contract[0]!.parameter.typeUrl).toBe(fixture.typeUrl)

  // serializeRawData reproduces the gold bytes exactly.
  expect(bytesToHex(serializeRawData(model)).slice(2)).toBe(fixture.rawDataHex)

  // getTransactionId matches TronWeb's independently-computed txID.
  expect(getTransactionId(model)).toBe(fixture.txID)

  // decodeRawData is a stable deep round-trip through our codec.
  expect(decodeRawData(serializeRawData(model))).toStrictEqual(model)

  // The (rawDataHex, txID) pair is self-consistent.
  expect(txCheck(fixture.rawDataHex, fixture.txID)).toBe(true)
})
