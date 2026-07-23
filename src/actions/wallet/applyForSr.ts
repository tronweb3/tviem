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
import type { WitnessCreateContract } from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type ApplyForSrParameters = {
  /** The signing (applicant) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Witness page URL (UTF-8 text). */
  url: string
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type ApplyForSrReturnType = BuildAndBroadcastReturnType

export type BuildApplyForSrParameters = ApplyForSrParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildApplyForSrReturnType = NodeTransaction

/** The signing account plus the assembled `WitnessCreateContract`. */
function assemble(
  client: Client,
  parameters: ApplyForSrParameters,
): { account: TronAccount; contract: RawContract } {
  const { url } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: WitnessCreateContract = {
    ownerAddress: toHex(account.address),
    url,
  }

  const contract: RawContract = {
    type: ContractType.WitnessCreateContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}WitnessCreateContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `WitnessCreateContract` transaction (§ type 5) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link applyForSr},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Witness URL, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildApplyForSr(
  client: Client,
  parameters: BuildApplyForSrParameters,
): Promise<BuildApplyForSrReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Applies to become a super representative (witness) by locally building,
 * signing and broadcasting a `WitnessCreateContract` (§ type 5).
 *
 * @param client The Client to use.
 * @param parameters Witness URL, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function applyForSr(
  client: Client,
  parameters: ApplyForSrParameters,
): Promise<ApplyForSrReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
