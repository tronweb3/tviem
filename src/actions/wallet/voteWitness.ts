import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import {
  AccountNotFoundError,
  type AccountNotFoundErrorType,
} from '../../errors/rpc.js'
import type { ErrorType } from '../../errors/utils.js'
import {
  type ParseAccountErrorType,
  parseAccount,
} from '../../types/account.js'
import type { Address } from '../../types/address.js'
import type { Hex } from '../../types/misc.js'
import { type ToHexErrorType, toHex } from '../../utils/address/toHex.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../utils/transaction/registry.js'
import type { RawContract } from '../../utils/transaction/serializeRawData.js'
import type { VoteWitnessContract } from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastErrorType,
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  type BuildTransactionErrorType,
  type BuildTransactionReturnType,
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

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
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
  /**
   * Transaction lifetime in ms, applied to the chain-derived timestamp
   * (`expiration = refBlock.timestamp + expirationMs`). Positive integer,
   * at most 86_400_000 (24h). Ignored when a complete `blockHeader` is
   * supplied. @default 60_000
   */
  expirationMs?: bigint | number | undefined
}
export type VoteWitnessReturnType = BuildAndBroadcastReturnType

export type VoteWitnessErrorType =
  | AccountNotFoundErrorType
  | BuildAndBroadcastErrorType
  | ParseAccountErrorType
  | ToHexErrorType
  | ErrorType

export type BuildVoteWitnessParameters = VoteWitnessParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildVoteWitnessReturnType = BuildTransactionReturnType

export type BuildVoteWitnessErrorType =
  | AccountNotFoundErrorType
  | BuildTransactionErrorType
  | ParseAccountErrorType
  | ToHexErrorType
  | ErrorType

/** The signing account plus the assembled `VoteWitnessContract`. */
function assemble(
  client: Client,
  parameters: VoteWitnessParameters,
): { account: TronAccount; contract: RawContract } {
  const { votes } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  // Build the VoteWitnessContract (addresses enter the body as 41-hex).
  const value: VoteWitnessContract = {
    owner_address: toHex(account.address),
    votes: votes.map((vote) => ({
      vote_address: toHex(vote.voteAddress),
      vote_count: vote.voteCount,
    })),
  }

  const contract: RawContract = {
    type: ContractType.VoteWitnessContract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}VoteWitnessContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `VoteWitnessContract` transaction (§ type 4) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link voteWitness},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Votes, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildVoteWitness(
  client: Client,
  parameters: BuildVoteWitnessParameters,
): Promise<BuildVoteWitnessReturnType> {
  const { contract } = assemble(client, parameters)
  return buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
    expirationMs: parameters.expirationMs,
  })
}

/**
 * Votes for super representatives by locally building, signing and
 * broadcasting a `VoteWitnessContract` (§ type 4). Voting replaces any
 * previous votes for the account.
 *
 * @param client The Client to use.
 * @param parameters Votes, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function voteWitness(
  client: Client,
  parameters: VoteWitnessParameters,
): Promise<VoteWitnessReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
    expirationMs: parameters.expirationMs,
  })
}
