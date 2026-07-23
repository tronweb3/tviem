// TRON-specific, clean-room implementation for @tronweb3/omni.
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
import type { ProposalDeleteContract } from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type DeleteProposalParameters = {
  /** The signing (proposer) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Id of the proposal to delete. */
  proposalId: bigint | number
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type DeleteProposalReturnType = BuildAndBroadcastReturnType

export type BuildDeleteProposalParameters = DeleteProposalParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildDeleteProposalReturnType = NodeTransaction

/** The signing account plus the assembled `ProposalDeleteContract`. */
function assemble(
  client: Client,
  parameters: DeleteProposalParameters,
): { account: TronAccount; contract: RawContract } {
  const { proposalId } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: ProposalDeleteContract = {
    ownerAddress: toHex(account.address),
    proposalId: BigInt(proposalId),
  }

  const contract: RawContract = {
    type: ContractType.ProposalDeleteContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}ProposalDeleteContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `ProposalDeleteContract` transaction (§ type 18) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link deleteProposal},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Proposal id, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildDeleteProposal(
  client: Client,
  parameters: BuildDeleteProposalParameters,
): Promise<BuildDeleteProposalReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Deletes a governance proposal by locally building, signing and broadcasting a
 * `ProposalDeleteContract` (§ type 18).
 *
 * @param client The Client to use.
 * @param parameters Proposal id, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function deleteProposal(
  client: Client,
  parameters: DeleteProposalParameters,
): Promise<DeleteProposalReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
