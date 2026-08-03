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
import type { UpdateSettingContract } from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type UpdateSettingParameters = {
  /** The signing (deployer/owner) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Contract to update. */
  contractAddress: Address
  /** New percentage of energy consumed by the caller, 0..100. */
  consumeUserResourcePercent: bigint
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type UpdateSettingReturnType = BuildAndBroadcastReturnType

export type BuildUpdateSettingParameters = UpdateSettingParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildUpdateSettingReturnType = NodeTransaction

/** The signing account plus the assembled `UpdateSettingContract`. */
function assemble(
  client: Client,
  parameters: UpdateSettingParameters,
): { account: TronAccount; contract: RawContract } {
  const { contractAddress, consumeUserResourcePercent } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: UpdateSettingContract = {
    owner_address: toHex(account.address),
    contract_address: toHex(contractAddress),
    consume_user_resource_percent: consumeUserResourcePercent,
  }

  const contract: RawContract = {
    type: ContractType.UpdateSettingContract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}UpdateSettingContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `UpdateSettingContract` transaction (§ type 33) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link updateSetting},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Contract address, resource percent, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildUpdateSetting(
  client: Client,
  parameters: BuildUpdateSettingParameters,
): Promise<BuildUpdateSettingReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Updates a smart contract's user resource-consumption percentage by locally
 * building, signing and broadcasting an `UpdateSettingContract` (§ type 33).
 *
 * @param client The Client to use.
 * @param parameters Contract address, resource percent, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function updateSetting(
  client: Client,
  parameters: UpdateSettingParameters,
): Promise<UpdateSettingReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
