import { expect, test } from 'vitest'
import { bytesToHex } from '../../../../src/utils/encoding/toHex.js'
import {
  decodeProposalCreateContract,
  encodeProposalCreateContract,
} from '../../../../src/utils/transaction/contracts/proposal.js'

const owner = '417e5f4552091a69125d5dfcb7b8c2659029395bdf' as const

// F-8P1: a proto `map<int64,int64>` serializes entries sorted by the
// STRINGIFIED key ascending (jspb.Map / java-tron canonical order — "10" < "2"),
// NOT by caller order and NOT by numeric key. Emitting caller/numeric order
// diverges raw_data_hex + txID from every other stack for multi-parameter
// proposals.
test('multi-entry map is emitted in stringified-key order (byte gold)', () => {
  const encoded = encodeProposalCreateContract({
    owner_address: owner,
    parameters: [
      { key: 2n, value: 1n },
      { key: 10n, value: 1n },
    ],
  })
  // owner(field 1) then two map entries in "10" < "2" order:
  //   entry {10,1} = 1204 080a 1001 ; entry {2,1} = 1204 0802 1001
  expect(bytesToHex(encoded)).toBe(`0x0a15${owner}1204080a1001120408021001`)
})

test('encoding is independent of caller entry order (canonical)', () => {
  const ascending = encodeProposalCreateContract({
    owner_address: owner,
    parameters: [
      { key: 2n, value: 1n },
      { key: 10n, value: 1n },
    ],
  })
  const descending = encodeProposalCreateContract({
    owner_address: owner,
    parameters: [
      { key: 10n, value: 1n },
      { key: 2n, value: 1n },
    ],
  })
  expect(bytesToHex(descending)).toBe(bytesToHex(ascending))
})

test('decode reflects the stringified-key order, not numeric', () => {
  const encoded = encodeProposalCreateContract({
    owner_address: owner,
    parameters: [
      { key: 2n, value: 1n },
      { key: 10n, value: 1n },
    ],
  })
  const decoded = decodeProposalCreateContract(encoded)
  // "10" sorts before "2" lexicographically; a numeric sort would give [2, 10].
  expect(decoded.parameters).toStrictEqual([
    { key: 10, value: 1 },
    { key: 2, value: 1 },
  ])
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
