import { expect, test } from 'vitest'
import { decodeRawData } from '../../../src/utils/transaction/decodeRawData.js'
import { getTransactionId } from '../../../src/utils/transaction/getTransactionId.js'
import {
  ContractType,
  contractTypeNameOf,
} from '../../../src/utils/transaction/registry.js'
import {
  type RawData,
  toRawDataHex,
} from '../../../src/utils/transaction/serializeRawData.js'
import { loadTxFixtures } from '../../fixtures/tx/loader.js'

// §2.3 canonical reference vector.
const owner = '417e5f4552091a69125d5dfcb7b8c2659029395bdf' as const
const to = '41928c9af0651632157ef27a2cf17ca72c575a4d21' as const
const canonical = loadTxFixtures().find(
  (f) => f.name === 'transfer canonical (reference vector)',
)!

test('§2.3 canonical: forward-serialize a hand-built raw data', () => {
  const rawData: RawData = {
    ref_block_bytes: '1234',
    ref_block_hash: '0102030405060708',
    expiration: 1700000060000n,
    contract: [
      {
        type: ContractType.TransferContract,
        parameter: {
          type_url: 'type.googleapis.com/protocol.TransferContract',
          value: { owner_address: owner, to_address: to, amount: 1000000n },
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
    ref_block_bytes: '1234',
    ref_block_hash: '0102030405060708',
    expiration: 1700000060000n,
    contract: [
      {
        type: ContractType.TransferContract,
        parameter: {
          type_url: 'type.googleapis.com/protocol.TransferContract',
          value: { owner_address: owner, to_address: to, amount: 1000000n },
        },
        Permission_id: 2,
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
  expect(rawData.contract[0]!.type).toBe(
    contractTypeNameOf(fixture.contractType) ?? fixture.contractType,
  )
  expect(rawData.contract[0]!.parameter.type_url).toBe(fixture.typeUrl)
})

test('serializeRawData omits zero fee_limit / timestamp (proto3 defaults)', () => {
  const rawData: RawData = {
    ref_block_bytes: '1234',
    ref_block_hash: '0102030405060708',
    expiration: 1700000060000n,
    contract: [
      {
        type: ContractType.TransferContract,
        parameter: {
          type_url: 'type.googleapis.com/protocol.TransferContract',
          value: { owner_address: owner, to_address: to, amount: 1000000n },
        },
      },
    ],
    timestamp: 0n,
    fee_limit: 0n,
  }
  const hex = toRawDataHex(rawData)
  // No trailing f14 (0x70) timestamp; raw ends at the contract's amount field.
  expect(hex.includes('7080d095')).toBe(false)
  expect(hex.endsWith('18c0843d')).toBe(true)
})

// K4 regression guard: a large contract bytecode must flow through the
// length-accumulation concat + streaming hash (never a `push(...spread)` /
// `String.fromCharCode(...)`), so txID stays computable for real deployments
// (java-tron's tx-size cap is ~500KB — 1MB is a comfortable margin). A future
// spread-based "simplification" of concatBytes/bytesToHex would overflow here.
test('serializes a 1MB contract bytecode to a txID without a stack overflow (K4)', () => {
  const bytecode = new Uint8Array(1024 * 1024).fill(0xab)
  const rawData: RawData = {
    ref_block_bytes: '1234',
    ref_block_hash: '0102030405060708',
    expiration: 1700000060000n,
    contract: [
      {
        type: ContractType.CreateSmartContract,
        parameter: {
          type_url: 'type.googleapis.com/protocol.CreateSmartContract',
          value: {
            owner_address: owner,
            new_contract: { origin_address: owner, bytecode },
          },
        },
      },
    ],
    timestamp: 1700000000000n,
  }
  let txId = ''
  expect(() => {
    txId = getTransactionId(rawData)
  }).not.toThrow()
  expect(txId).toMatch(/^[0-9a-f]{64}$/)
})
