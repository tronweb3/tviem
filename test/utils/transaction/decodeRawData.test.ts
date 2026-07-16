import { expect, test } from 'vitest'

import { loadTxFixtures } from '../../fixtures/tx/loader.js'
import { concatBytes } from '../../../src/utils/data/concat.js'
import { hexToBytes } from '../../../src/utils/encoding/toBytes.js'
import { bytesToHex } from '../../../src/utils/encoding/toHex.js'
import { decodeRawData } from '../../../src/utils/transaction/decodeRawData.js'
import { fBytes, fInt, fMessage } from '../../../src/utils/transaction/protobuf/writer.js'
import type { UnknownContractParameter } from '../../../src/utils/transaction/types.js'

const canonical = loadTxFixtures().find(
  (f) => f.name === 'transfer canonical (reference vector)',
)!

test('§2.3 canonical: decode deeply equals the raw data model', () => {
  expect(decodeRawData(canonical.rawDataHex)).toStrictEqual({
    refBlockBytes: '1234',
    refBlockHash: '0102030405060708',
    expiration: 1700000060000n,
    contract: [
      {
        type: 1,
        parameter: {
          typeUrl: 'type.googleapis.com/protocol.TransferContract',
          value: {
            ownerAddress: '417e5f4552091a69125d5dfcb7b8c2659029395bdf',
            toAddress: '41928c9af0651632157ef27a2cf17ca72c575a4d21',
            amount: 1000000n,
          },
        },
      },
    ],
    timestamp: 1700000000000n,
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
  expect(decoded.contract[0]!.permissionId).toBe(2)
})

test.each(
  loadTxFixtures(),
)('decode recovers contract type and type URL: $name', (fixture) => {
  const decoded = decodeRawData(fixture.rawDataHex)
  expect(decoded.contract).toHaveLength(1)
  expect(decoded.contract[0]!.type).toBe(fixture.contractType)
  expect(decoded.contract[0]!.parameter.typeUrl).toBe(fixture.typeUrl)
})

test('unregistered contract type falls back to UnknownContractParameter', () => {
  const typeUrl = 'type.googleapis.com/protocol.MysteryContract'
  const valueBytes = hexToBytes('0xdeadbeef')
  const any = concatBytes([
    fBytes(1, new TextEncoder().encode(typeUrl)),
    fBytes(2, valueBytes),
  ])
  const contract = concatBytes([fInt(1, 999), fBytes(2, any)])
  const raw = concatBytes([fMessage(11, contract, { emitDefault: true })])
  const decoded = decodeRawData(raw)
  const value = decoded.contract[0]!.parameter.value as UnknownContractParameter
  expect(value.__unknown).toBe(true)
  expect(value.typeUrl).toBe(typeUrl)
  expect(bytesToHex(value.valueBytes)).toBe('0xdeadbeef')
})

test('tolerates unknown raw-level and contract-level fields without throwing', () => {
  const base = hexToBytes(`0x${canonical.rawDataHex}`)
  // Append a raw-level ref_block_num (field 3, VARINT) — must be ignored.
  const withExtra = concatBytes([base, fInt(3, 42)])
  expect(() => decodeRawData(withExtra)).not.toThrow()
  const decoded = decodeRawData(withExtra)
  expect(decoded.contract[0]!.parameter.typeUrl).toBe(canonical.typeUrl)
})
