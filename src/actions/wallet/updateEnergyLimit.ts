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
import type { UpdateEnergyLimitContract } from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  type BuildTransactionReturnType,
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type UpdateEnergyLimitParameters = {
  /** The signing (deployer/owner) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Contract to update. */
  contractAddress: Address
  /** New creator energy limit. */
  originEnergyLimit: bigint
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type UpdateEnergyLimitReturnType = BuildAndBroadcastReturnType

export type BuildUpdateEnergyLimitParameters = UpdateEnergyLimitParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildUpdateEnergyLimitReturnType = BuildTransactionReturnType

/** The signing account plus the assembled `UpdateEnergyLimitContract`. */
function assemble(
  client: Client,
  parameters: UpdateEnergyLimitParameters,
): { account: TronAccount; contract: RawContract } {
  const { contractAddress, originEnergyLimit } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: UpdateEnergyLimitContract = {
    owner_address: toHex(account.address),
    contract_address: toHex(contractAddress),
    origin_energy_limit: originEnergyLimit,
  }

  const contract: RawContract = {
    type: ContractType.UpdateEnergyLimitContract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}UpdateEnergyLimitContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `UpdateEnergyLimitContract` transaction (§ type 45) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of
 * {@link updateEnergyLimit}, without signing or broadcasting. Pass
 * `permissionId` to bind it to an active/owner permission. The node is used only
 * to fetch the latest block (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Contract address, energy limit, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildUpdateEnergyLimit(
  client: Client,
  parameters: BuildUpdateEnergyLimitParameters,
): Promise<BuildUpdateEnergyLimitReturnType> {
  const { contract } = assemble(client, parameters)
  return buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
}

/**
 * Updates a smart contract's creator energy limit by locally building, signing
 * and broadcasting an `UpdateEnergyLimitContract` (§ type 45).
 *
 * @param client The Client to use.
 * @param parameters Contract address, energy limit, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function updateEnergyLimit(
  client: Client,
  parameters: UpdateEnergyLimitParameters,
): Promise<UpdateEnergyLimitReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
