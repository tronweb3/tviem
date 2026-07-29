// TRON-specific, clean-room implementation for @tronweb3/tviem.
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
import type { ProposalCreateContract } from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

/** A single proposed chain-parameter change (`map<int64,int64>` entry). */
export type ProposalParameterInput = {
  /** Chain-parameter id (map key). */
  key: number | bigint
  /** New parameter value (map value). */
  value: number | bigint
}

/**
 * Proposed chain-parameter changes: either an array of `{ key, value }` entries
 * or a `Record<paramId, value>` (normalized to ascending-key entries).
 */
export type ProposalParametersInput =
  | ProposalParameterInput[]
  | Record<number, number | bigint>

export type CreateProposalParameters = {
  /** The signing (proposer) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Proposed chain-parameter changes. */
  parameters: ProposalParametersInput
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type CreateProposalReturnType = BuildAndBroadcastReturnType

export type BuildCreateProposalParameters = CreateProposalParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildCreateProposalReturnType = NodeTransaction

/** Normalizes proposal parameters to ascending-key `{ key, value }` bigints. */
function normalizeParameters(
  input: ProposalParametersInput,
): { key: bigint; value: bigint }[] {
  if (Array.isArray(input))
    return input.map((entry) => ({
      key: BigInt(entry.key),
      value: BigInt(entry.value),
    }))
  return Object.keys(input)
    .map(Number)
    .sort((a, b) => a - b)
    .map((key) => ({ key: BigInt(key), value: BigInt(input[key] as number) }))
}

/** The signing account plus the assembled `ProposalCreateContract`. */
function assemble(
  client: Client,
  parameters: CreateProposalParameters,
): { account: TronAccount; contract: RawContract } {
  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: ProposalCreateContract = {
    ownerAddress: toHex(account.address),
    parameters: normalizeParameters(parameters.parameters),
  }

  const contract: RawContract = {
    type: ContractType.ProposalCreateContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}ProposalCreateContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `ProposalCreateContract` transaction (§ type 16) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link createProposal},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Proposed changes, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildCreateProposal(
  client: Client,
  parameters: BuildCreateProposalParameters,
): Promise<BuildCreateProposalReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Creates a governance proposal to change chain parameters by locally building,
 * signing and broadcasting a `ProposalCreateContract` (§ type 16).
 *
 * @param client The Client to use.
 * @param parameters Proposed changes, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function createProposal(
  client: Client,
  parameters: CreateProposalParameters,
): Promise<CreateProposalReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
