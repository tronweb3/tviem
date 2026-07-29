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
import type { WitnessUpdateContract } from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type UpdateWitnessParameters = {
  /** The signing (witness) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** New witness page URL (UTF-8 text). */
  url: string
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type UpdateWitnessReturnType = BuildAndBroadcastReturnType

export type BuildUpdateWitnessParameters = UpdateWitnessParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildUpdateWitnessReturnType = NodeTransaction

/** The signing account plus the assembled `WitnessUpdateContract`. */
function assemble(
  client: Client,
  parameters: UpdateWitnessParameters,
): { account: TronAccount; contract: RawContract } {
  const { url } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: WitnessUpdateContract = {
    ownerAddress: toHex(account.address),
    updateUrl: url,
  }

  const contract: RawContract = {
    type: ContractType.WitnessUpdateContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}WitnessUpdateContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `WitnessUpdateContract` transaction (§ type 8) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link updateWitness},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Witness URL, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildUpdateWitness(
  client: Client,
  parameters: BuildUpdateWitnessParameters,
): Promise<BuildUpdateWitnessReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Updates a super representative's page URL by locally building, signing and
 * broadcasting a `WitnessUpdateContract` (§ type 8).
 *
 * @param client The Client to use.
 * @param parameters Witness URL, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function updateWitness(
  client: Client,
  parameters: UpdateWitnessParameters,
): Promise<UpdateWitnessReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
