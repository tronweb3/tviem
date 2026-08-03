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
import type { UpdateBrokerageContract } from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type UpdateBrokerageParameters = {
  /** The signing (witness) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** New brokerage percentage the SR keeps for its voters, 0..100. */
  brokerage: number
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type UpdateBrokerageReturnType = BuildAndBroadcastReturnType

export type BuildUpdateBrokerageParameters = UpdateBrokerageParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildUpdateBrokerageReturnType = NodeTransaction

/** The signing account plus the assembled `UpdateBrokerageContract`. */
function assemble(
  client: Client,
  parameters: UpdateBrokerageParameters,
): { account: TronAccount; contract: RawContract } {
  const { brokerage } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: UpdateBrokerageContract = {
    owner_address: toHex(account.address),
    brokerage,
  }

  const contract: RawContract = {
    type: ContractType.UpdateBrokerageContract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}UpdateBrokerageContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `UpdateBrokerageContract` transaction (§ type 49) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link updateBrokerage},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Brokerage percentage, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildUpdateBrokerage(
  client: Client,
  parameters: BuildUpdateBrokerageParameters,
): Promise<BuildUpdateBrokerageReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Sets a super representative's brokerage ratio (the percentage of block/vote
 * rewards it keeps versus shares with its voters) by locally building, signing
 * and broadcasting an `UpdateBrokerageContract` (§ type 49).
 *
 * @param client The Client to use.
 * @param parameters Brokerage percentage, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function updateBrokerage(
  client: Client,
  parameters: UpdateBrokerageParameters,
): Promise<UpdateBrokerageReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
