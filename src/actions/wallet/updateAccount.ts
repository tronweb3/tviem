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
import type { AccountUpdateContract } from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type UpdateAccountParameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** New account name (UTF-8 text). */
  accountName: string
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type UpdateAccountReturnType = BuildAndBroadcastReturnType

export type BuildUpdateAccountParameters = UpdateAccountParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildUpdateAccountReturnType = NodeTransaction

/** The signing account plus the assembled `AccountUpdateContract`. */
function assemble(
  client: Client,
  parameters: UpdateAccountParameters,
): { account: TronAccount; contract: RawContract } {
  const { accountName } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: AccountUpdateContract = {
    accountName,
    ownerAddress: toHex(account.address),
  }

  const contract: RawContract = {
    type: ContractType.AccountUpdateContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}AccountUpdateContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `AccountUpdateContract` transaction (§ type 10) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link updateAccount},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Account name, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildUpdateAccount(
  client: Client,
  parameters: BuildUpdateAccountParameters,
): Promise<BuildUpdateAccountReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Sets the account's on-chain name by locally building, signing and
 * broadcasting an `AccountUpdateContract` (§ type 10).
 *
 * @param client The Client to use.
 * @param parameters Account name, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function updateAccount(
  client: Client,
  parameters: UpdateAccountParameters,
): Promise<UpdateAccountReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
