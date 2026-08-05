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
import type { WithdrawBalanceContract } from '../../utils/transaction/types.js'
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

export type WithdrawBalanceParameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type WithdrawBalanceReturnType = BuildAndBroadcastReturnType

export type WithdrawBalanceErrorType =
  | AccountNotFoundErrorType
  | BuildAndBroadcastErrorType
  | ParseAccountErrorType
  | ToHexErrorType
  | ErrorType

export type BuildWithdrawBalanceParameters = WithdrawBalanceParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildWithdrawBalanceReturnType = BuildTransactionReturnType

export type BuildWithdrawBalanceErrorType =
  | AccountNotFoundErrorType
  | BuildTransactionErrorType
  | ParseAccountErrorType
  | ToHexErrorType
  | ErrorType

/** The signing account plus the assembled `WithdrawBalanceContract`. */
function assemble(
  client: Client,
  parameters: WithdrawBalanceParameters,
): { account: TronAccount; contract: RawContract } {
  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: WithdrawBalanceContract = {
    owner_address: toHex(account.address),
  }

  const contract: RawContract = {
    type: ContractType.WithdrawBalanceContract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}WithdrawBalanceContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `WithdrawBalanceContract` transaction (§ type 13) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link withdrawBalance},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildWithdrawBalance(
  client: Client,
  parameters: BuildWithdrawBalanceParameters = {},
): Promise<BuildWithdrawBalanceReturnType> {
  const { contract } = assemble(client, parameters)
  return buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
}

/**
 * Withdraws accrued staking/voting rewards to the account's spendable balance
 * by locally building, signing and broadcasting a `WithdrawBalanceContract`
 * (§ type 13).
 *
 * @param client The Client to use.
 * @param parameters Optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function withdrawBalance(
  client: Client,
  parameters: WithdrawBalanceParameters = {},
): Promise<WithdrawBalanceReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
