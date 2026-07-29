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
import type { SetAccountIdContract } from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type SetAccountIdParameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Account id to set (hex string, `0x` prefix optional). */
  accountId: string
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type SetAccountIdReturnType = BuildAndBroadcastReturnType

export type BuildSetAccountIdParameters = SetAccountIdParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildSetAccountIdReturnType = NodeTransaction

/** The signing account plus the assembled `SetAccountIdContract`. */
function assemble(
  client: Client,
  parameters: SetAccountIdParameters,
): { account: TronAccount; contract: RawContract } {
  const { accountId } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: SetAccountIdContract = {
    accountId,
    ownerAddress: toHex(account.address),
  }

  const contract: RawContract = {
    type: ContractType.SetAccountIdContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}SetAccountIdContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `SetAccountIdContract` transaction (§ type 19) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link setAccountId},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Account id, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildSetAccountId(
  client: Client,
  parameters: BuildSetAccountIdParameters,
): Promise<BuildSetAccountIdReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Sets a unique on-chain account id by locally building, signing and
 * broadcasting a `SetAccountIdContract` (§ type 19).
 *
 * @param client The Client to use.
 * @param parameters Account id, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function setAccountId(
  client: Client,
  parameters: SetAccountIdParameters,
): Promise<SetAccountIdReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
