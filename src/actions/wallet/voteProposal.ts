import type { AccountKey, TronAccount } from '../../accounts/types.js'
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
import {
  type AddressToHexErrorType,
  addressToHex,
} from '../../utils/address/addressToHex.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../utils/transaction/registry.js'
import type { RawContract } from '../../utils/transaction/serializeRawData.js'
import type { ProposalApproveContract } from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastErrorType,
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  type BuildTransactionErrorType,
  type BuildTransactionReturnType,
  buildTransaction,
  type MemoInput,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type VoteProposalParameters = {
  /** The signing (voter) account (falls back to `client.account`). */
  account?: TronAccount | AccountKey | undefined
  /** Id of the proposal to vote on. */
  proposalId: bigint | number
  /**
   * `true` adds approval, `false` removes it. Required: the two directions are
   * opposite votes, so there is no default to fall back to.
   */
  isApproval: boolean
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
  /**
   * Optional memo written to `raw_data.data` (hex or raw bytes). Enters the
   * signed bytes; the chain charges a memo fee (`getMemoFee`, 1 TRX on
   * mainnet and Nile) on top of the transaction's normal costs.
   */
  memo?: MemoInput | undefined
}
export type VoteProposalReturnType = BuildAndBroadcastReturnType

export type VoteProposalErrorType =
  | AccountNotFoundErrorType
  | BuildAndBroadcastErrorType
  | ParseAccountErrorType
  | AddressToHexErrorType
  | ErrorType

export type BuildVoteProposalParameters = VoteProposalParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildVoteProposalReturnType = BuildTransactionReturnType

export type BuildVoteProposalErrorType =
  | AccountNotFoundErrorType
  | BuildTransactionErrorType
  | ParseAccountErrorType
  | AddressToHexErrorType
  | ErrorType

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
    owner_address: addressToHex(account.address),
    proposal_id: BigInt(proposalId),
    is_add_approval: isApproval,
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
 * returns it in java-tron's HTTP JSON shape (`{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link voteProposal},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Proposal id + approval flag, optional account/permissionId/blockHeader.
 * @returns An unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildVoteProposal(
  client: Client,
  parameters: BuildVoteProposalParameters,
): Promise<BuildVoteProposalReturnType> {
  const { contract } = assemble(client, parameters)
  return buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
    expirationMs: parameters.expirationMs,
    memo: parameters.memo,
  })
}

/**
 * Approves (or disapproves) a governance proposal by locally building, signing
 * and broadcasting a `ProposalApproveContract` (§ type 17).
 *
 * @param client The Client to use.
 * @param parameters Proposal id + approval flag, optional account/blockHeader.
 * @returns `{ txID, result, code, message }` — the locally computed
 * transaction id plus the node's acknowledgement fields, when echoed.
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
    expirationMs: parameters.expirationMs,
    memo: parameters.memo,
  })
}
