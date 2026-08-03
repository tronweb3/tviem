import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import { AccountNotFoundError } from '../../errors/rpc.js'
import { parseAccount } from '../../types/account.js'
import type { Hex } from '../../types/misc.js'
import { toHex } from '../../utils/address/toHex.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../utils/transaction/registry.js'
import type { RawContract } from '../../utils/transaction/serializeRawData.js'
import {
  type NodeTransaction,
  toNodeTransaction,
} from '../../utils/transaction/toNodeTransaction.js'
import type { ProposalApproveContract } from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type VoteProposalParameters = {
  /** The signing (voter) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Id of the proposal to vote on. */
  proposalId: bigint | number
  /** Whether to add (default) or remove approval. */
  isApproval?: boolean | undefined
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type VoteProposalReturnType = BuildAndBroadcastReturnType

export type BuildVoteProposalParameters = VoteProposalParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildVoteProposalReturnType = NodeTransaction

/**
 * The signing account plus the assembled `ProposalApproveContract`. Note the
 * java-tron message/type name is `ProposalApproveContract` (TronWeb calls the
 * builder `voteProposal`).
 */
function assemble(
  client: Client,
  parameters: VoteProposalParameters,
): { account: TronAccount; contract: RawContract } {
  const { proposalId, isApproval } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: ProposalApproveContract = {
    owner_address: toHex(account.address),
    proposal_id: BigInt(proposalId),
    is_add_approval: isApproval ?? true,
  }

  const contract: RawContract = {
    type: ContractType.ProposalApproveContract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}ProposalApproveContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `ProposalApproveContract` transaction (§ type 17) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link voteProposal},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Proposal id + approval flag, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildVoteProposal(
  client: Client,
  parameters: BuildVoteProposalParameters,
): Promise<BuildVoteProposalReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Approves (or disapproves) a governance proposal by locally building, signing
 * and broadcasting a `ProposalApproveContract` (§ type 17).
 *
 * @param client The Client to use.
 * @param parameters Proposal id + approval flag, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function voteProposal(
  client: Client,
  parameters: VoteProposalParameters,
): Promise<VoteProposalReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
