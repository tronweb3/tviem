import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import {
  AccountNotFoundError,
  type AccountNotFoundErrorType,
} from '../../errors/rpc.js'
import type { ErrorType } from '../../errors/utils.js'
import {
  type ParseAccountErrorType,
  parseAccount,
} from '../../types/account.js'
import type { Hex } from '../../types/misc.js'
import { type ToHexErrorType, toHex } from '../../utils/address/toHex.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../utils/transaction/registry.js'
import type { RawContract } from '../../utils/transaction/serializeRawData.js'
import {
  type ResourceCodeOfErrorType,
  resourceCodeOf,
} from '../../utils/transaction/types.js'
import type { StakeResource } from './freezeBalanceV2.js'
import {
  type BuildAndBroadcastErrorType,
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  type BuildTransactionErrorType,
  type BuildTransactionReturnType,
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type UnfreezeBalanceV2Parameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Amount to unfreeze, in SUN. */
  unfreezeBalance: bigint
  /** Resource previously frozen. */
  resource: StakeResource
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type UnfreezeBalanceV2ReturnType = BuildAndBroadcastReturnType

export type UnfreezeBalanceV2ErrorType =
  | AccountNotFoundErrorType
  | BuildAndBroadcastErrorType
  | ParseAccountErrorType
  | ResourceCodeOfErrorType
  | ToHexErrorType
  | ErrorType

export type BuildUnfreezeBalanceV2Parameters = UnfreezeBalanceV2Parameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildUnfreezeBalanceV2ReturnType = BuildTransactionReturnType

export type BuildUnfreezeBalanceV2ErrorType =
  | AccountNotFoundErrorType
  | BuildTransactionErrorType
  | ParseAccountErrorType
  | ResourceCodeOfErrorType
  | ToHexErrorType
  | ErrorType

/** The signing account plus the assembled `UnfreezeBalanceV2Contract`. */
function assemble(
  client: Client,
  parameters: UnfreezeBalanceV2Parameters,
): { account: TronAccount; contract: RawContract } {
  const { unfreezeBalance, resource } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const contract: RawContract = {
    type: ContractType.UnfreezeBalanceV2Contract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}UnfreezeBalanceV2Contract`,
      value: {
        owner_address: toHex(account.address),
        unfreeze_balance: unfreezeBalance,
        resource: resourceCodeOf(resource),
      },
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `UnfreezeBalanceV2Contract` transaction (§ type 55) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link unfreezeBalanceV2},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Amount, resource, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildUnfreezeBalanceV2(
  client: Client,
  parameters: BuildUnfreezeBalanceV2Parameters,
): Promise<BuildUnfreezeBalanceV2ReturnType> {
  const { contract } = assemble(client, parameters)
  return buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
}

/**
 * Unstakes (unfreezes) TRX previously frozen for bandwidth or energy under
 * Stake 2.0 by locally building, signing and broadcasting an
 * `UnfreezeBalanceV2Contract` (§ type 55). The unfrozen amount enters a 14-day
 * withdrawal window, after which `withdrawExpireUnfreeze` releases it.
 *
 * @param client The Client to use.
 * @param parameters Amount, resource, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function unfreezeBalanceV2(
  client: Client,
  parameters: UnfreezeBalanceV2Parameters,
): Promise<UnfreezeBalanceV2ReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
