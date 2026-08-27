import { expect, test } from 'vitest'
import { UnknownContractTypeError } from '../../../src/errors/transaction.js'
import { concatBytes } from '../../../src/utils/data/concat.js'
import { bareHex } from '../../../src/utils/encoding/bareHex.js'
import {
  hexToBytes,
  stringToBytes,
} from '../../../src/utils/encoding/toBytes.js'
import { bytesToHex } from '../../../src/utils/encoding/toHex.js'
import { sha256 } from '../../../src/utils/hash/sha256.js'
import { decodeRawData } from '../../../src/utils/transaction/decodeRawData.js'
import {
  fBytes,
  fInt,
  fMessage,
} from '../../../src/utils/transaction/protobuf/writer.js'
import { contractTypeNameOf } from '../../../src/utils/transaction/registry.js'
import { toRawDataHex } from '../../../src/utils/transaction/serializeRawData.js'
import { txCheck } from '../../../src/utils/transaction/txCheck.js'
import { loadTxFixtures } from '../../fixtures/tx/loader.js'

const canonical = loadTxFixtures().find(
  (f) => f.name === 'transfer canonical (reference vector)',
)!

test('§2.3 canonical: decode deeply equals the node-JSON raw data', () => {
  expect(decodeRawData(canonical.rawDataHex)).toStrictEqual({
    ref_block_bytes: '1234',
    ref_block_hash: '0102030405060708',
    expiration: 1700000060000,
    contract: [
      {
        type: 'TransferContract',
        parameter: {
          type_url: 'type.googleapis.com/protocol.TransferContract',
          value: {
            owner_address: '417e5f4552091a69125d5dfcb7b8c2659029395bdf',
            to_address: '41928c9af0651632157ef27a2cf17ca72c575a4d21',
            amount: 1000000,
          },
        },
      },
    ],
    timestamp: 1700000000000,
  })
})

test('decode accepts both bare and 0x-prefixed hex, and bytes', () => {
  const bare = decodeRawData(canonical.rawDataHex)
  const prefixed = decodeRawData(`0x${canonical.rawDataHex}`)
  const bytes = decodeRawData(hexToBytes(`0x${canonical.rawDataHex}`))
  expect(prefixed).toStrictEqual(bare)
  expect(bytes).toStrictEqual(bare)
})

test('§2.3 canonical: Permission_id decodes onto the contract', () => {
  const withPermission = loadTxFixtures().find(
    (f) => f.name === 'transfer with Permission_id=2',
  )!
  const decoded = decodeRawData(withPermission.rawDataHex)
  expect(decoded.contract[0]!.Permission_id).toBe(2)
})

test.each(
  loadTxFixtures(),
)('decode recovers contract type and type URL: $name', (fixture) => {
  const decoded = decodeRawData(fixture.rawDataHex)
  expect(decoded.contract).toHaveLength(1)
  // The canonical form carries the type NAME (java-tron's JSON rendering);
  // strict decode guarantees every fixture type is registered.
  expect(decoded.contract[0]!.type).toBe(
    contractTypeNameOf(fixture.contractType)!,
  )
  expect(decoded.contract[0]!.parameter.type_url).toBe(fixture.typeUrl)
})

test('unregistered contract type URL throws (strict)', () => {
  const typeUrl = 'type.googleapis.com/protocol.MysteryContract'
  const valueBytes = hexToBytes('0xdeadbeef')
  const any = concatBytes([
    fBytes(1, new TextEncoder().encode(typeUrl)),
    fBytes(2, valueBytes),
  ])
  // A registered type integer (1), so the type-URL check is what fires.
  const contract = concatBytes([fInt(1, 1), fBytes(2, any)])
  const raw = concatBytes([fMessage(11, contract, { emitDefault: true })])
  expect(() => decodeRawData(raw)).toThrow(
    'Contract type "type.googleapis.com/protocol.MysteryContract" is not supported.',
  )
})

test('unregistered contract type integer throws even with a known type URL', () => {
  const typeUrl = 'type.googleapis.com/protocol.TransferContract'
  const any = concatBytes([
    fBytes(1, new TextEncoder().encode(typeUrl)),
    fBytes(2, new Uint8Array(0)),
  ])
  const contract = concatBytes([fInt(1, 999), fBytes(2, any)])
  const raw = concatBytes([fMessage(11, contract, { emitDefault: true })])
  expect(() => decodeRawData(raw)).toThrow(
    'Contract type 999 is not supported.',
  )
})

test('a contract type that does not match the parameter type URL throws', () => {
  const typeUrl = 'type.googleapis.com/protocol.TransferContract'
  const any = concatBytes([
    fBytes(1, new TextEncoder().encode(typeUrl)),
    fBytes(2, new Uint8Array(0)),
  ])
  // Type 31 (TriggerSmartContract) wrapping a TransferContract Any: the
  // model's label would misrepresent its payload.
  const contract = concatBytes([fInt(1, 31), fBytes(2, any)])
  const raw = concatBytes([fMessage(11, contract, { emitDefault: true })])
  expect(() => decodeRawData(raw)).toThrow(
    'Contract type "TriggerSmartContract" does not match its parameter type URL "type.googleapis.com/protocol.TransferContract".',
  )
})

test('tolerates unknown raw-level fields without throwing', () => {
  const base = hexToBytes(`0x${canonical.rawDataHex}`)
  // Raw-level ref_block_num (3, VARINT), witness (9, LEN) and scripts
  // (12, LEN) — all ignored.
  const withExtra = concatBytes([
    base,
    fInt(3, 42),
    fBytes(9, new Uint8Array([1, 2])),
    fBytes(12, new Uint8Array([3, 4])),
  ])
  const decoded = decodeRawData(withExtra)
  expect(decoded.contract[0]!.parameter.type_url).toBe(canonical.typeUrl)
  // Ignored fields are dropped, not round-tripped.
  expect(toRawDataHex(decoded)).toBe(canonical.rawDataHex)
})

// §2.1 V1, §2.3 `to` (transfer body reused by the synthetic contracts below).
const v1 = '417e5f4552091a69125d5dfcb7b8c2659029395bdf'
const to = '41928c9af0651632157ef27a2cf17ca72c575a4d21'
const transferTypeUrl = 'type.googleapis.com/protocol.TransferContract'
const transferBody = `0x0a15${v1}1215${to}18c0843d`

test('tolerates contract-level provider/ContractName fields without throwing', () => {
  const any = concatBytes([
    fBytes(1, new TextEncoder().encode(transferTypeUrl)),
    fBytes(2, hexToBytes(transferBody)),
  ])
  const contract = concatBytes([
    fInt(1, 1),
    fBytes(2, any),
    // provider (3) and ContractName (4) — ignored.
    fBytes(3, new Uint8Array([9, 9])),
    fBytes(4, new Uint8Array([8, 8])),
  ])
  const raw = concatBytes([fMessage(11, contract, { emitDefault: true })])
  const clean = concatBytes([
    fMessage(11, concatBytes([fInt(1, 1), fBytes(2, any)]), {
      emitDefault: true,
    }),
  ])
  const decoded = decodeRawData(raw)
  expect(decoded.contract[0]!.type).toBe('TransferContract')
  // Ignored fields are dropped, not round-tripped.
  expect(toRawDataHex(decoded)).toBe(bytesToHex(clean).slice(2))
})

test('an unknown wire field inside a contract body throws end-to-end', () => {
  const value = concatBytes([
    hexToBytes(transferBody),
    // Field 31, VARINT, value 7 — outside the TransferContract schema.
    new Uint8Array([0xf8, 0x01, 0x07]),
  ])
  const any = concatBytes([
    fBytes(1, new TextEncoder().encode(transferTypeUrl)),
    fBytes(2, value),
  ])
  const contract = concatBytes([fInt(1, 1), fBytes(2, any)])
  const raw = concatBytes([fMessage(11, contract, { emitDefault: true })])
  expect(() => decodeRawData(raw)).toThrow(
    'Unknown wire field 31 (wire type 0) in contract message.',
  )
})

test('int32 fields decode as java-tron reads them, not as the sender wrote them', () => {
  // An AssetIssueContract whose trx_num (field 6, int32) carries a value the
  // type cannot hold. Only a foreign transaction can look like this — this
  // encoder bounds int32 fields — and java-tron's parser keeps the low 32
  // bits, so 5_000_000_000 is the value 705_032_704 on chain.
  const assetTypeUrl = 'type.googleapis.com/protocol.AssetIssueContract'
  const body = concatBytes([
    fBytes(1, hexToBytes(`0x${v1}`)),
    fInt(6, 5_000_000_000n),
  ])
  const any = concatBytes([
    fBytes(1, new TextEncoder().encode(assetTypeUrl)),
    fBytes(2, body),
  ])
  const raw = concatBytes([
    fMessage(11, concatBytes([fInt(1, 6), fBytes(2, any)]), {
      emitDefault: true,
    }),
  ])

  const value = decodeRawData(raw).contract[0]!.parameter.value as {
    trx_num?: number
  }
  expect(value.trx_num).toBe(705_032_704)
})

test('a negative Permission_id decodes as int32, not as a huge positive', () => {
  const any = concatBytes([
    fBytes(1, new TextEncoder().encode(transferTypeUrl)),
    fBytes(2, hexToBytes(transferBody)),
  ])
  // Permission_id (contract field 5, int32) as a 10-byte two's complement -1.
  const raw = concatBytes([
    fMessage(11, concatBytes([fInt(1, 1), fBytes(2, any), fInt(5, -1)]), {
      emitDefault: true,
    }),
  ])

  // Read as a raw unsigned varint this would surface as ~1.8e19.
  expect(decodeRawData(raw).contract[0]!.Permission_id).toBe(-1)
})

// ---- codec-less enum types: readable, never serializable ------------------

/** Assembles a raw_data carrying one contract of `type` with opaque bytes. */
function codeclessRawHex(type: number, typeUrl: string): string {
  const body = hexToBytes('0x0a15417e5f4552091a69125d5dfcb7b8c2659029395bdf')
  const any = concatBytes([fBytes(1, stringToBytes(typeUrl)), fBytes(2, body)])
  const contract = concatBytes([
    fInt(1, type),
    fBytes(2, any, { emitDefault: true }),
  ])
  const raw = concatBytes([
    fBytes(1, hexToBytes('0x1234')),
    fBytes(4, hexToBytes('0x0102030405060708')),
    fMessage(11, contract, { emitDefault: true }),
  ])
  return bytesToHex(raw).slice(2)
}

test('a codec-less enum type decodes with a bare-hex body', () => {
  const hex = codeclessRawHex(
    52,
    'type.googleapis.com/protocol.MarketSellAssetContract',
  )
  const decoded = decodeRawData(hex)
  expect(decoded.contract[0]).toStrictEqual({
    type: 'MarketSellAssetContract',
    parameter: {
      type_url: 'type.googleapis.com/protocol.MarketSellAssetContract',
      value: '0a15417e5f4552091a69125d5dfcb7b8c2659029395bdf',
    },
  })
})

test('a codec-less contract never re-serializes, so it can never sign', () => {
  const hex = codeclessRawHex(
    52,
    'type.googleapis.com/protocol.MarketSellAssetContract',
  )
  const decoded = decodeRawData(hex)
  expect(() => toRawDataHex(decoded)).toThrow(UnknownContractTypeError)
  // The full triple — even with the CORRECT id for these bytes — fails the
  // integrity check, because the model cannot be byte-verified.
  const txID = bareHex(sha256(hexToBytes(`0x${hex}`)))
  expect(txCheck({ txID, raw_data: decoded, raw_data_hex: hex })).toBe(false)
})

test('a codec-less type with a mismatched type URL still throws', () => {
  expect(() =>
    decodeRawData(
      codeclessRawHex(52, 'type.googleapis.com/protocol.TransferContract'),
    ),
  ).toThrow(
    'Contract type "MarketSellAssetContract" does not match its parameter type URL',
  )
})

test('a type integer outside the enum still throws', () => {
  expect(() =>
    decodeRawData(codeclessRawHex(99, 'type.googleapis.com/protocol.Foo')),
  ).toThrow(UnknownContractTypeError)
})
