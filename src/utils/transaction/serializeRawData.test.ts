import { expect, test } from 'vitest'

import { loadTxFixtures } from '../../../test/fixtures/tx/loader.js'
import { decodeRawData } from './decodeRawData.js'
import { ContractType } from './registry.js'
import { type RawData, toRawDataHex } from './serializeRawData.js'

// §2.3 canonical reference vector.
const owner = '417e5f4552091a69125d5dfcb7b8c2659029395bdf' as const
const to = '41928c9af0651632157ef27a2cf17ca72c575a4d21' as const
const canonical = loadTxFixtures().find(
  (f) => f.name === 'transfer canonical (reference vector)',
)!

test('§2.3 canonical: forward-serialize a hand-built raw data', () => {
  const rawData: RawData = {
    refBlockBytes: '1234',
    refBlockHash: '0102030405060708',
    expiration: 1700000060000n,
    contract: [
      {
        type: ContractType.TransferContract,
        parameter: {
          typeUrl: 'type.googleapis.com/protocol.TransferContract',
          value: { ownerAddress: owner, toAddress: to, amount: 1000000n },
        },
      },
    ],
    timestamp: 1700000000000n,
  }
  expect(toRawDataHex(rawData)).toBe(canonical.rawDataHex)
})

test('§2.3 canonical: Permission_id is contract field 5', () => {
  const withPermission = loadTxFixtures().find(
    (f) => f.name === 'transfer with Permission_id=2',
  )!
  const rawData: RawData = {
    refBlockBytes: '1234',
    refBlockHash: '0102030405060708',
    expiration: 1700000060000n,
    contract: [
      {
        type: ContractType.TransferContract,
        parameter: {
          typeUrl: 'type.googleapis.com/protocol.TransferContract',
          value: { ownerAddress: owner, toAddress: to, amount: 1000000n },
        },
        permissionId: 2,
      },
    ],
    timestamp: 1700000000000n,
  }
  expect(toRawDataHex(rawData)).toBe(withPermission.rawDataHex)
})

test('toRawDataHex is bare lowercase hex (no 0x)', () => {
  const hex = toRawDataHex(decodeRawData(canonical.rawDataHex))
  expect(hex.startsWith('0x')).toBe(false)
  expect(hex).toBe(hex.toLowerCase())
})

// Re-serializing the decode of each gold `raw_data_hex` reproduces it
// byte-for-byte — the encode path, exercised over all 13 contract types.
test.each(
  loadTxFixtures(),
)('serialize round-trips gold raw_data_hex: $name', (fixture) => {
  const rawData = decodeRawData(fixture.rawDataHex)
  expect(toRawDataHex(rawData)).toBe(fixture.rawDataHex)
  expect(rawData.contract[0]!.type).toBe(fixture.contractType)
  expect(rawData.contract[0]!.parameter.typeUrl).toBe(fixture.typeUrl)
})

test('serializeRawData omits zero fee_limit / timestamp (proto3 defaults)', () => {
  const rawData: RawData = {
    refBlockBytes: '1234',
    refBlockHash: '0102030405060708',
    expiration: 1700000060000n,
    contract: [
      {
        type: ContractType.TransferContract,
        parameter: {
          typeUrl: 'type.googleapis.com/protocol.TransferContract',
          value: { ownerAddress: owner, toAddress: to, amount: 1000000n },
        },
      },
    ],
    timestamp: 0n,
    feeLimit: 0n,
  }
  const hex = toRawDataHex(rawData)
  // No trailing f14 (0x70) timestamp; raw ends at the contract's amount field.
  expect(hex.includes('7080d095')).toBe(false)
  expect(hex.endsWith('18c0843d')).toBe(true)
})
