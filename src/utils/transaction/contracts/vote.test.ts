import { expect, test } from 'vitest'

import { bytesToHex } from '../../encoding/toHex.js'
import type { VoteWitnessContract } from '../types.js'
import { decodeVoteWitnessContract, encodeVoteWitnessContract } from './vote.js'

// §2.1 V1 / V2, §2.3 `to`.
const v1 = '417e5f4552091a69125d5dfcb7b8c2659029395bdf' as const
const v2 = '412b5ad5c4795c026514f8317c7a215e218dccd6cf' as const
const to = '41928c9af0651632157ef27a2cf17ca72c575a4d21' as const

test('encodeVoteWitnessContract: repeated votes', () => {
  const encoded = encodeVoteWitnessContract({
    ownerAddress: v1,
    votes: [{ voteAddress: v2, voteCount: 5n }],
    support: true,
  })
  expect(bytesToHex(encoded)).toBe(`0x0a15${v1}12190a15${v2}10051801`)
})

test('encodeVoteWitnessContract: one field-2 entry per vote', () => {
  const encoded = encodeVoteWitnessContract({
    ownerAddress: v1,
    votes: [
      { voteAddress: v2, voteCount: 5n },
      { voteAddress: to, voteCount: 1_000_000n },
    ],
  })
  expect(bytesToHex(encoded)).toBe(
    `0x0a15${v1}12190a15${v2}1005121b0a15${to}10c0843d`,
  )
})

test('decodeVoteWitnessContract: missing repeated/bool fields fill defaults', () => {
  const decoded = decodeVoteWitnessContract(
    encodeVoteWitnessContract({ ownerAddress: v1 }),
  )
  expect(decoded).toStrictEqual({
    ownerAddress: v1,
    votes: [],
    support: false,
  })
})

test('decode(encode(x)) round-trips', () => {
  const x: VoteWitnessContract = {
    ownerAddress: v1,
    votes: [
      { voteAddress: v2, voteCount: 5n },
      { voteAddress: to, voteCount: 1_000_000n },
    ],
    support: true,
  }
  expect(decodeVoteWitnessContract(encodeVoteWitnessContract(x))).toStrictEqual(
    x,
  )
})
