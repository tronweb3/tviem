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
import {
  type NodeTransaction,
  toNodeTransaction,
} from '../../utils/transaction/toNodeTransaction.js'
import {
  ResourceCode,
  type UnDelegateResourceContract,
} from '../../utils/transaction/types.js'
import type { DelegateResource } from './delegateResource.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type UndelegateResourceParameters = {
  /** The signing (delegator) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Account the resource was delegated to. */
  receiverAddress: Address
  /** Amount to undelegate, in SUN. */
  balance: bigint
  /** Resource undelegated. */
  resource: DelegateResource
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type UndelegateResourceReturnType = BuildAndBroadcastReturnType

export type BuildUndelegateResourceParameters = UndelegateResourceParameters & {
  /**
   * Multi-sig permission id (`Contract.Permission_id`) to bind the transaction
   * to an active/owner permission.
   */
  permissionId?: number | undefined
}
export type BuildUndelegateResourceReturnType = NodeTransaction

/** The signing account plus the assembled `UnDelegateResourceContract`. */
function assemble(
  client: Client,
  parameters: UndelegateResourceParameters,
): { account: TronAccount; contract: RawContract } {
  const { receiverAddress, balance, resource } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: UnDelegateResourceContract = {
    ownerAddress: toHex(account.address),
    resource: ResourceCode[resource],
    balance,
    receiverAddress: toHex(receiverAddress),
  }

  const contract: RawContract = {
    type: ContractType.UnDelegateResourceContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}UnDelegateResourceContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `UnDelegateResourceContract` transaction (§ type 58)
 * and returns it in java-tron's HTTP JSON shape (TronWeb-compatible
 * `{ visible, txID, raw_data, raw_data_hex }`) — the build half of
 * {@link undelegateResource}, without signing or broadcasting. Pass
 * `permissionId` to bind it to an active/owner permission. The node is used
 * only to fetch the latest block (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Receiver, amount, resource, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildUndelegateResource(
  client: Client,
  parameters: BuildUndelegateResourceParameters,
): Promise<BuildUndelegateResourceReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Reclaims resource previously delegated to another account under Stake 2.0 by
 * locally building, signing and broadcasting an `UnDelegateResourceContract`
 * (§ type 58).
 *
 * @param client The Client to use.
 * @param parameters Receiver, amount, resource, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function undelegateResource(
  client: Client,
  parameters: UndelegateResourceParameters,
): Promise<UndelegateResourceReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, { contract, account, blockHeader: parameters.blockHeader })
}
