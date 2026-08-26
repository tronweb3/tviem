import type { ErrorType } from '../../../errors/utils.js'
import type { ByteArray } from '../../../types/misc.js'
import type { VoteWitnessContract } from '../types.js'
import {
  type DecodeMessageErrorType,
  decodeMessage,
  type EncodeMessageErrorType,
  encodeMessage,
  type MessageSpec,
} from './codec.js'

/** `Vote` field schema (nested in `VoteWitnessContract`). */
const voteSpec: MessageSpec = [
  { no: 1, name: 'vote_address', kind: 'address', required: true },
  { no: 2, name: 'vote_count', kind: 'i64', required: true },
]

/** `VoteWitnessContract` (type 4) field schema. */
const voteWitnessContractSpec: MessageSpec = [
  { no: 1, name: 'owner_address', kind: 'address', required: true },
  {
    no: 2,
    name: 'votes',
    kind: 'repeated-message',
    spec: voteSpec,
    required: true,
  },
  { no: 3, name: 'support', kind: 'bool' },
]

export type EncodeVoteWitnessContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes a `VoteWitnessContract` (contract type 4) body. */
export function encodeVoteWitnessContract(
  message: VoteWitnessContract,
): ByteArray {
  return encodeMessage(voteWitnessContractSpec, message)
}

export type DecodeVoteWitnessContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes a `VoteWitnessContract` body. */
export function decodeVoteWitnessContract(
  bytes: ByteArray,
): VoteWitnessContract {
  return decodeMessage(voteWitnessContractSpec, bytes) as VoteWitnessContract
}
