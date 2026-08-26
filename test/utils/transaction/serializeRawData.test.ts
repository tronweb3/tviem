import { expect, test } from 'vitest'
import { IntegerOutOfRangeError } from '../../../src/errors/encoding.js'
import { UnknownContractTypeError } from '../../../src/errors/transaction.js'
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
import type { Int64 } from '../../../src/utils/transaction/types.js'
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

test('an unregistered contract type name throws (strict)', () => {
  const rawData: RawData = {
    contract: [
      {
        // @ts-expect-error deliberately invalid contract type name
        type: 'FooBarContract',
        parameter: {
          type_url: 'type.googleapis.com/protocol.TransferContract',
          value: { owner_address: owner, to_address: to, amount: 1n },
        },
      },
    ],
  }
  expect(() => toRawDataHex(rawData)).toThrow(UnknownContractTypeError)
  expect(() => toRawDataHex(rawData)).toThrow(
    'Contract type "FooBarContract" is not supported.',
  )
})

test('an unsupported contract throws UnknownContractTypeError, not a bare BaseError', () => {
  const rawData: RawData = {
    contract: [
      {
        // @ts-expect-error a java-tron contract type tviem does not support
        type: 'MarketSellAssetContract',
        parameter: {
          type_url: 'type.googleapis.com/protocol.MarketSellAssetContract',
          value: { owner_address: owner },
        },
      },
    ],
  }
  let error: unknown
  try {
    toRawDataHex(rawData)
  } catch (caught) {
    error = caught
  }
  // Type and type URL both name the same unregistered contract — the only
  // shape the decode-side cross-check lets through, so encode must surface
  // the same error class the decode path throws for it.
  expect(error).toBeInstanceOf(UnknownContractTypeError)
  const typed = error as UnknownContractTypeError
  expect(typed.type).toBe('MarketSellAssetContract')
  expect(typed.shortMessage).toBe(
    'Contract type "MarketSellAssetContract" is not supported.',
  )
})

test('a contract type that does not match the parameter type URL throws', () => {
  const rawData: RawData = {
    contract: [
      {
        type: 'TriggerSmartContract',
        parameter: {
          type_url: 'type.googleapis.com/protocol.TransferContract',
          value: { owner_address: owner, to_address: to, amount: 1n },
        },
      },
    ],
  }
  expect(() => toRawDataHex(rawData)).toThrow(
    'Contract type "TriggerSmartContract" does not match its parameter type URL "type.googleapis.com/protocol.TransferContract".',
  )
})

test('a registered type with an unregistered type_url throws (strict)', () => {
  const rawData: RawData = {
    contract: [
      {
        type: ContractType.TransferContract,
        parameter: {
          type_url: 'type.googleapis.com/protocol.FooContract',
          value: { owner_address: owner, to_address: to, amount: 1n },
        },
      },
    ],
  }
  expect(() => toRawDataHex(rawData)).toThrow(
    'No contract codec registered for "type.googleapis.com/protocol.FooContract".',
  )
})

test('an unregistered contract type integer throws (strict)', () => {
  const rawData: RawData = {
    contract: [
      {
        type: 999,
        parameter: {
          type_url: 'type.googleapis.com/protocol.TransferContract',
          value: { owner_address: owner, to_address: to, amount: 1n },
        },
      },
    ],
  }
  expect(() => toRawDataHex(rawData)).toThrow(UnknownContractTypeError)
  expect(() => toRawDataHex(rawData)).toThrow(
    'Contract type 999 is not supported.',
  )
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

test('int32 fields are bounded to int32; int64 fields are not', () => {
  /** A `raw_data` whose AssetIssue `trx_num` (an int32 field) is `trxNum`. */
  const assetIssue = (trxNum: number): RawData => ({
    ref_block_bytes: '1234',
    ref_block_hash: '0102030405060708',
    expiration: 1700000060000n,
    contract: [
      {
        type: ContractType.AssetIssueContract,
        parameter: {
          type_url: 'type.googleapis.com/protocol.AssetIssueContract',
          value: {
            owner_address: owner,
            name: '746f6b656e',
            abbr: '746b6e',
            total_supply: 1000n,
            trx_num: trxNum,
            num: 1,
            start_time: 1700000000000n,
            end_time: 1700086400000n,
            url: '68747470',
          },
        },
      },
    ],
    timestamp: 1700000000000n,
  })

  // Both ends of the declared type still encode.
  expect(() => toRawDataHex(assetIssue(2147483647))).not.toThrow()
  expect(() => toRawDataHex(assetIssue(-2147483648))).not.toThrow()

  // Past them, refuse. java-tron would not read back what was signed: its JSON
  // endpoint drops the contract outright, and on the byte-exact path
  // `readInt32` keeps the low 32 bits — 5_000_000_000 becomes 705_032_704,
  // still positive, so the actuator accepts a token priced 7x off intent.
  expect(() => toRawDataHex(assetIssue(2147483648))).toThrow(
    IntegerOutOfRangeError,
  )
  expect(() => toRawDataHex(assetIssue(5_000_000_000))).toThrow(
    IntegerOutOfRangeError,
  )
  expect(() => toRawDataHex(assetIssue(-2147483649))).toThrow(
    IntegerOutOfRangeError,
  )

  // The bound must not leak onto int64 fields: `total_supply` is int64 and a
  // value far past int32 is perfectly legal there.
  const bigSupply = assetIssue(1)
  ;(
    bigSupply.contract[0]!.parameter.value as { total_supply: bigint }
  ).total_supply = 90_000_000_000_000_000n
  expect(() => toRawDataHex(bigSupply)).not.toThrow()
})

test('Permission_id is bounded to int32', () => {
  const withPermission = (id: number): RawData => ({
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
        Permission_id: id,
      },
    ],
    timestamp: 1700000000000n,
  })

  expect(() => toRawDataHex(withPermission(2147483647))).not.toThrow()
  expect(() => toRawDataHex(withPermission(2147483648))).toThrow(
    IntegerOutOfRangeError,
  )
})

test('int64 fields are bounded to signed int64 on the wire', () => {
  const withFeeLimit = (fee_limit: bigint): RawData => ({
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
    fee_limit,
  })

  // 2^63-1 is the max legal int64; 2^63 would decode back as a negative value
  // the sender never wrote, so it must be refused at encode.
  expect(() => toRawDataHex(withFeeLimit(9223372036854775807n))).not.toThrow()
  expect(() => toRawDataHex(withFeeLimit(9223372036854775808n))).toThrow(
    IntegerOutOfRangeError,
  )
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
  // Strict decode guarantees every fixture type is registered.
  expect(rawData.contract[0]!.type).toBe(
    contractTypeNameOf(fixture.contractType)!,
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
            new_contract: {
              origin_address: owner,
              bytecode,
              origin_energy_limit: 10000000n,
            },
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

test('raw-level byte fields reject odd-nibble hex instead of left-padding', () => {
  // These are already-serialized bytes: '123' padded to '0123' would sign
  // different bytes than the caller wrote. Whole bytes only — SIZE is not
  // checked here (that is the action layer's business), only fidelity.
  const base = { contract: [] }
  expect(() =>
    toRawDataHex({ ...base, ref_block_bytes: '123' } as RawData),
  ).toThrow('odd length')
  expect(() =>
    toRawDataHex({ ...base, ref_block_hash: '0102030405060' } as RawData),
  ).toThrow('odd length')
  expect(() => toRawDataHex({ ...base, data: 'abc' } as RawData)).toThrow(
    'odd length',
  )
})

test('int64 inputs reject what cannot round-trip', () => {
  const transfer = (amount: Int64): RawData => ({
    ref_block_bytes: '1234',
    ref_block_hash: '0102030405060708',
    expiration: 1700000060000n,
    timestamp: 1700000000000n,
    contract: [
      {
        type: ContractType.TransferContract,
        parameter: {
          type_url: 'type.googleapis.com/protocol.TransferContract',
          value: { owner_address: owner, to_address: to, amount },
        },
      },
    ],
  })

  // The exact safe boundary still encodes; so do bigint and decimal-string
  // values far past it.
  expect(() => toRawDataHex(transfer(9007199254740991))).not.toThrow()
  expect(() => toRawDataHex(transfer(90_000_000_000_000_000n))).not.toThrow()
  expect(() => toRawDataHex(transfer('90000000000000000'))).not.toThrow()

  // A number past 2^53 has ALREADY been rounded by IEEE-754 — BigInt() would
  // faithfully sign a value the caller never wrote (off by 1 SUN here).
  expect(() => toRawDataHex(transfer(Number(9007199254740993n)))).toThrow(
    'not a safe integer',
  )
  // Fractions and non-decimal strings used to escape as raw RangeError /
  // SyntaxError from inside BigInt().
  expect(() => toRawDataHex(transfer(1.5))).toThrow('not a safe integer')
  expect(() => toRawDataHex(transfer('1.5'))).toThrow(
    'not a decimal integer string',
  )
  expect(() => toRawDataHex(transfer('abc'))).toThrow(
    'not a decimal integer string',
  )

  // The raw-level int64 fields carry the same guard.
  expect(() =>
    toRawDataHex({
      ...transfer(1n),
      fee_limit: Number(9007199254740993n),
    }),
  ).toThrow('Invalid fee_limit')
  expect(() => toRawDataHex({ ...transfer(1n), expiration: '1e10' })).toThrow(
    'Invalid expiration',
  )
})
