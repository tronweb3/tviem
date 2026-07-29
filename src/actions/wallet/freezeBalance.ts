// TRON-specific, clean-room implementation for @tronweb3/tviem.
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
  type FreezeBalanceContract,
  ResourceCode,
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

export type FreezeBalanceParameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Amount to freeze, in SUN. */
  frozenBalance: bigint
  /** Freeze duration, in days. */
  frozenDuration: bigint
  /** Resource obtained by freezing. */
  resource: StakeResource
  /** Address the resource is obtained for (defaults to the owner). */
  receiverAddress?: Address | undefined
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type FreezeBalanceReturnType = BuildAndBroadcastReturnType

export type BuildFreezeBalanceParameters = FreezeBalanceParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildFreezeBalanceReturnType = NodeTransaction

/** The signing account plus the assembled `FreezeBalanceContract`. */
function assemble(
  client: Client,
  parameters: FreezeBalanceParameters,
): { account: TronAccount; contract: RawContract } {
  const { frozenBalance, frozenDuration, resource, receiverAddress } =
    parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: FreezeBalanceContract = {
    ownerAddress: toHex(account.address),
    frozenBalance,
    frozenDuration,
    resource: ResourceCode[resource],
  }
  if (receiverAddress !== undefined)
    value.receiverAddress = toHex(receiverAddress)

  const contract: RawContract = {
    type: ContractType.FreezeBalanceContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}FreezeBalanceContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `FreezeBalanceContract` transaction (§ type 11, Stake
 * 1.0) and returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{
 * visible, txID, raw_data, raw_data_hex }`) — the build half of
 * {@link freezeBalance}, without signing or broadcasting. Pass `permissionId`
 * to bind it to an active/owner permission. The node is used only to fetch the
 * latest block (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Amount, duration, resource, optional account/receiver/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildFreezeBalance(
  client: Client,
  parameters: BuildFreezeBalanceParameters,
): Promise<BuildFreezeBalanceReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Stakes (freezes) TRX for bandwidth or energy under Stake 1.0 by locally
 * building, signing and broadcasting a `FreezeBalanceContract` (§ type 11).
 *
 * @param client The Client to use.
 * @param parameters Amount, duration, resource, optional account/receiver/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function freezeBalance(
  client: Client,
  parameters: FreezeBalanceParameters,
): Promise<FreezeBalanceReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
