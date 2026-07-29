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
import {
  type NodeTransaction,
  toNodeTransaction,
} from '../../utils/transaction/toNodeTransaction.js'
import {
  ResourceCode,
  type UnfreezeBalanceContract,
} from '../../utils/transaction/types.js'
import type { StakeResource } from './freezeBalanceV2.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type UnfreezeBalanceParameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Resource to unfreeze. */
  resource: StakeResource
  /** Address the resource was obtained for (defaults to the owner). */
  receiverAddress?: Address | undefined
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type UnfreezeBalanceReturnType = BuildAndBroadcastReturnType

export type BuildUnfreezeBalanceParameters = UnfreezeBalanceParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildUnfreezeBalanceReturnType = NodeTransaction

/** The signing account plus the assembled `UnfreezeBalanceContract`. */
function assemble(
  client: Client,
  parameters: UnfreezeBalanceParameters,
): { account: TronAccount; contract: RawContract } {
  const { resource, receiverAddress } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: UnfreezeBalanceContract = {
    ownerAddress: toHex(account.address),
    resource: ResourceCode[resource],
  }
  if (receiverAddress !== undefined)
    value.receiverAddress = toHex(receiverAddress)

  const contract: RawContract = {
    type: ContractType.UnfreezeBalanceContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}UnfreezeBalanceContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `UnfreezeBalanceContract` transaction (§ type 12,
 * Stake 1.0) and returns it in java-tron's HTTP JSON shape (TronWeb-compatible
 * `{ visible, txID, raw_data, raw_data_hex }`) — the build half of
 * {@link unfreezeBalance}, without signing or broadcasting. Pass `permissionId`
 * to bind it to an active/owner permission. The node is used only to fetch the
 * latest block (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Resource, optional account/receiver/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildUnfreezeBalance(
  client: Client,
  parameters: BuildUnfreezeBalanceParameters,
): Promise<BuildUnfreezeBalanceReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Unstakes (unfreezes) TRX previously frozen under Stake 1.0 by locally
 * building, signing and broadcasting an `UnfreezeBalanceContract` (§ type 12).
 *
 * @param client The Client to use.
 * @param parameters Resource, optional account/receiver/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function unfreezeBalance(
  client: Client,
  parameters: UnfreezeBalanceParameters,
): Promise<UnfreezeBalanceReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
