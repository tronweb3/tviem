import { expect, test } from 'vitest'

import { loadTxFixtures } from '../../fixtures/tx/loader.js'
import { sha256 } from '../../../src/utils/hash/sha256.js'
import { decodeRawData } from '../../../src/utils/transaction/decodeRawData.js'
import { getTransactionId } from '../../../src/utils/transaction/getTransactionId.js'
import { serializeRawData, toRawDataHex } from '../../../src/utils/transaction/serializeRawData.js'

const canonical = loadTxFixtures().find(
  (f) => f.name === 'transfer canonical (reference vector)',
)!

test('§2.3 canonical: txID is sha256(raw_data)', () => {
  const rawData = decodeRawData(canonical.rawDataHex)
  expect(getTransactionId(rawData)).toBe(canonical.txID)
  expect(getTransactionId(rawData)).toBe(
    sha256(serializeRawData(rawData), 'hex').slice(2),
  )
})

test.each(loadTxFixtures())('txID matches gold vector: $name', (fixture) => {
  expect(getTransactionId(decodeRawData(fixture.rawDataHex))).toBe(fixture.txID)
})

// The id hashes only the serialized `raw_data`; signatures live outside it,
// so the id depends solely on the raw data bytes.
test('txID depends only on the serialized raw_data bytes', () => {
  const rawData = decodeRawData(canonical.rawDataHex)
  const fromHex = sha256(
    hexToBytesOfRawData(toRawDataHex(rawData)),
    'hex',
  ).slice(2)
  expect(getTransactionId(rawData)).toBe(fromHex)
})

function hexToBytesOfRawData(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return bytes
}
