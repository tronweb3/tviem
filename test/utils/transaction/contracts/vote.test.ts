import { expect, test } from 'vitest'

import { bytesToHex } from '../../../../src/utils/encoding/toHex.js'
import {
  decodeVoteWitnessContract,
  encodeVoteWitnessContract,
} from '../../../../src/utils/transaction/contracts/vote.js'
import type { VoteWitnessContract } from '../../../../src/utils/transaction/types.js'

// §2.1 V1 / V2, §2.3 `to`.
const v1 = '417e5f4552091a69125d5dfcb7b8c2659029395bdf' as const
const v2 = '412b5ad5c4795c026514f8317c7a215e218dccd6cf' as const
const to = '41928c9af0651632157ef27a2cf17ca72c575a4d21' as const

test('encodeVoteWitnessContract: repeated votes', () => {
  const encoded = encodeVoteWitnessContract({
    owner_address: v1,
    votes: [{ vote_address: v2, vote_count: 5n }],
    support: true,
  })
  expect(bytesToHex(encoded)).toBe(`0x0a15${v1}12190a15${v2}10051801`)
})

test('encodeVoteWitnessContract: one field-2 entry per vote', () => {
  const encoded = encodeVoteWitnessContract({
    owner_address: v1,
    votes: [
      { vote_address: v2, vote_count: 5n },
      { vote_address: to, vote_count: 1_000_000n },
    ],
  })
  expect(bytesToHex(encoded)).toBe(
    `0x0a15${v1}12190a15${v2}1005121b0a15${to}10c0843d`,
  )
})

test('decodeVoteWitnessContract: absent fields stay absent (defaults omitted)', () => {
  const decoded = decodeVoteWitnessContract(
    encodeVoteWitnessContract({ owner_address: v1 }),
  )
  expect(decoded).toStrictEqual({ owner_address: v1 })
})

test('decode(encode(x)) canonicalizes to the node-JSON form', () => {
  const x: VoteWitnessContract = {
    owner_address: v1,
    votes: [
      { vote_address: v2, vote_count: 5n },
      { vote_address: to, vote_count: 1_000_000n },
    ],
    support: true,
  }
  expect(decodeVoteWitnessContract(encodeVoteWitnessContract(x))).toStrictEqual(
    {
      owner_address: v1,
      votes: [
        { vote_address: v2, vote_count: 5 },
        { vote_address: to, vote_count: 1_000_000 },
      ],
      support: true,
    },
  )
})
