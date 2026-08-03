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
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type CancelAllUnfreezeV2Parameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type CancelAllUnfreezeV2ReturnType = BuildAndBroadcastReturnType

export type BuildCancelAllUnfreezeV2Parameters =
  CancelAllUnfreezeV2Parameters & {
    /** Multi-sig permission id (`Contract.Permission_id`). */
    permissionId?: number | undefined
  }
export type BuildCancelAllUnfreezeV2ReturnType = NodeTransaction

/** The signing account plus the assembled `CancelAllUnfreezeV2Contract`. */
function assemble(
  client: Client,
  parameters: CancelAllUnfreezeV2Parameters,
): { account: TronAccount; contract: RawContract } {
  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  // Build the CancelAllUnfreezeV2Contract (carries only the owner address).
  const contract: RawContract = {
    type: ContractType.CancelAllUnfreezeV2Contract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}CancelAllUnfreezeV2Contract`,
      value: {
        owner_address: toHex(account.address),
      },
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `CancelAllUnfreezeV2Contract` transaction (§ type 59)
 * and returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link cancelAllUnfreezeV2},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildCancelAllUnfreezeV2(
  client: Client,
  parameters: BuildCancelAllUnfreezeV2Parameters = {},
): Promise<BuildCancelAllUnfreezeV2ReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Cancels all pending Stake 2.0 unfreeze requests, re-staking their amounts,
 * by locally building, signing and broadcasting a `CancelAllUnfreezeV2Contract`
 * (§ type 59). Carries only the owner address.
 *
 * @param client The Client to use.
 * @param parameters Optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function cancelAllUnfreezeV2(
  client: Client,
  parameters: CancelAllUnfreezeV2Parameters = {},
): Promise<CancelAllUnfreezeV2ReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
