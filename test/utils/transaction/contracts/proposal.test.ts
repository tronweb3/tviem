import { expect, test } from 'vitest'
import { bareHex } from '../../../../src/utils/encoding/bareHex.js'
import { hexToBytes } from '../../../../src/utils/encoding/toBytes.js'
import { bytesToHex } from '../../../../src/utils/encoding/toHex.js'
import { sha256 } from '../../../../src/utils/hash/sha256.js'
import {
  decodeProposalCreateContract,
  encodeProposalCreateContract,
} from '../../../../src/utils/transaction/contracts/proposal.js'
import { txCheck } from '../../../../src/utils/transaction/txCheck.js'

const owner = '417e5f4552091a69125d5dfcb7b8c2659029395bdf' as const

// Protobuf leaves map wire order unspecified, and java-tron both emits and
// re-parses `parameters` in the order given (measured on
// `/wallet/proposalcreate` and on the broadcast JSON-to-protobuf rebuild). The
// codec therefore serializes the MODEL order — re-ordering here would make an
// externally built, self-consistent triple fail the sign path's byte
// verification. The canonical order for this SDK's own builds is applied in
// the createProposal action.
test('map entries are emitted in model order (byte gold)', () => {
  const encoded = encodeProposalCreateContract({
    owner_address: owner,
    parameters: [
      { key: 2n, value: 1n },
      { key: 10n, value: 1n },
    ],
  })
  // owner(field 1) then the two map entries exactly as given:
  //   entry {2,1} = 1204 0802 1001 ; entry {10,1} = 1204 080a 1001
  expect(bytesToHex(encoded)).toBe(`0x0a15${owner}1204080210011204080a1001`)
})

test('a different model order emits different bytes (order is the model’s)', () => {
  const descending = encodeProposalCreateContract({
    owner_address: owner,
    parameters: [
      { key: 10n, value: 1n },
      { key: 2n, value: 1n },
    ],
  })
  expect(bytesToHex(descending)).toBe(`0x0a15${owner}1204080a1001120408021001`)
})

test('decode reflects the byte order (round-trips the model order)', () => {
  const encoded = encodeProposalCreateContract({
    owner_address: owner,
    parameters: [
      { key: 2n, value: 1n },
      { key: 10n, value: 1n },
    ],
  })
  expect(decodeProposalCreateContract(encoded).parameters).toStrictEqual([
    { key: 2, value: 1 },
    { key: 10, value: 1 },
  ])
})

// The interop case the model-order rule exists for: a triple built elsewhere
// (this one pins the bytes java-tron's `/wallet/proposalcreate` returns for
// caller order [11, 2, 1]) must verify and stay signable as-is.
test('an externally built caller-order proposal passes txCheck', () => {
  const rawData = {
    ref_block_bytes: '1234',
    ref_block_hash: '0102030405060708',
    expiration: 1700000060000n,
    contract: [
      {
        type: 'ProposalCreateContract',
        parameter: {
          type_url: 'type.googleapis.com/protocol.ProposalCreateContract',
          value: {
            owner_address: owner,
            parameters: [
              { key: 11, value: 300 },
              { key: 2, value: 200 },
              { key: 1, value: 100 },
            ],
          },
        },
      },
    ],
    timestamp: 1700000000000n,
  }
  // Entry order inside the pinned bytes: {11,300} {2,200} {1,100}.
  const rawDataHex =
    '0a0212342208010203040506070840e0a499ffbc315a66081012620a33747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e50726f706f73616c437265617465436f6e7472616374122b0a15417e5f4552091a69125d5dfcb7b8c2659029395bdf1205080b10ac021205080210c8011204080110647080d095ffbc31'
  const txID = bareHex(sha256(hexToBytes(`0x${rawDataHex}`)))
  expect(
    txCheck({ txID, raw_data: rawData as never, raw_data_hex: rawDataHex }),
  ).toBe(true)
})

test('a value-0 map entry is force-emitted and round-trips', () => {
  const encoded = encodeProposalCreateContract({
    owner_address: owner,
    parameters: [{ key: 5n, value: 0n }],
  })
  // key 5 (0805) + value 0 force-emitted (1000): entry body = 0805 1000,
  // wrapped as map entry 1204 08051000.
  expect(bytesToHex(encoded)).toBe(`0x0a15${owner}120408051000`)
  expect(decodeProposalCreateContract(encoded).parameters).toStrictEqual([
    { key: 5, value: 0 },
  ])
})

// This codec is hand-rolled (the map encoding can't reuse encodeMessage), so it
// must re-establish the same strictness by hand: the sign path byte-verifies
// its output, and the high-level createProposal action is not the only way in
// (a foreign raw_data reaches this codec directly through serializeRawData).

test('rejects an unknown top-level field', () => {
  expect(() =>
    encodeProposalCreateContract({
      owner_address: owner,
      parameters: [{ key: 1n, value: 1n }],
      extra: 1,
    } as never),
  ).toThrow(/Unknown ProposalCreateContract field "extra"/)
})

test('rejects an unknown map-entry field', () => {
  expect(() =>
    encodeProposalCreateContract({
      owner_address: owner,
      parameters: [{ key: 1n, value: 1n, note: 2n }],
    } as never),
  ).toThrow(/Unknown proposal parameter field "note"/)
})

test('rejects a duplicate key (including 1 vs 1n)', () => {
  expect(() =>
    encodeProposalCreateContract({
      owner_address: owner,
      parameters: [
        { key: 1, value: 1n },
        { key: 1n, value: 2n },
      ],
    }),
  ).toThrow(/Duplicate proposal parameter key 1/)
})

test('rejects a non-array parameters', () => {
  expect(() =>
    encodeProposalCreateContract({
      owner_address: owner,
      parameters: { key: 1n, value: 1n } as never,
    }),
  ).toThrow(/parameters must be an array/)
})

test('rejects a hex-string / unsafe-number key or value', () => {
  expect(() =>
    encodeProposalCreateContract({
      owner_address: owner,
      parameters: [{ key: '0x10' as never, value: 1n }],
    }),
  ).toThrow(/proposal parameter key/)
  expect(() =>
    encodeProposalCreateContract({
      owner_address: owner,
      parameters: [{ key: 1n, value: Number.MAX_SAFE_INTEGER + 2 }],
    }),
  ).toThrow(/proposal parameter value/)
})
