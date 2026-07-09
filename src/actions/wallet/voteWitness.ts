// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import { AccountNotFoundError } from '../../errors/rpc.js'
import { parseAccount } from '../../types/account.js'
import type { Address } from '../../types/address.js'
import type { Hex } from '../../types/misc.js'
import { toHex } from '../../utils/address/toHex.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../utils/transaction/registry.js'
import type { RawContract } from '../../utils/transaction/serializeRawData.js'
import type { VoteWitnessContract } from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'

/** A single super-representative vote. */
export type WitnessVote = {
  /** Witness (SR) address voted for. */
  voteAddress: Address
  /** Number of votes cast for this witness. */
  voteCount: bigint
}

export type VoteWitnessParameters = {
  /** The signing (voter) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Votes to cast (replaces the account's current votes). */
  votes: WitnessVote[]
  /** Injectable clock (ms since epoch) for deterministic tests. */
  now?: bigint | undefined
}
export type VoteWitnessReturnType = BuildAndBroadcastReturnType

/**
 * Votes for super representatives by locally building, signing and
 * broadcasting a `VoteWitnessContract` (§ type 4). Voting replaces any
 * previous votes for the account.
 *
 * @param client The Client to use.
 * @param parameters Votes, optional account/clock.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function voteWitness(
  client: Client,
  parameters: VoteWitnessParameters,
): Promise<VoteWitnessReturnType> {
  const { votes } = parameters

  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const now = parameters.now ?? BigInt(Date.now())

  const value: VoteWitnessContract = {
    ownerAddress: toHex(account.address),
    votes: votes.map((vote) => ({
      voteAddress: toHex(vote.voteAddress),
      voteCount: vote.voteCount,
    })),
  }

  const contract: RawContract = {
    type: ContractType.VoteWitnessContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}VoteWitnessContract`,
      value,
    },
  }

  return buildAndBroadcast(client, { contract, account, now })
}
