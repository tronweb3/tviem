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
import type { Address } from '../../types/address.js'
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
  type UnfreezeBalanceContract,
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
  type MemoInput,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type UnfreezeBalanceParameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Resource to unfreeze. */
  resource: StakeResource
  /** Address the resource was obtained for (defaults to the owner). */
  receiverAddress?: Address | undefined
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
  /**
   * Transaction lifetime in ms, applied to the chain-derived timestamp
   * (`expiration = refBlock.timestamp + expirationMs`). Positive integer,
   * at most 86_400_000 (24h). Ignored when a complete `blockHeader` is
   * supplied. @default 60_000
   */
  expirationMs?: bigint | number | undefined
  /**
   * Optional memo written to `raw_data.data` (hex or raw bytes). Enters the
   * signed bytes; the chain charges a memo fee (`getMemoFee`, 1 TRX on
   * mainnet and Nile) on top of the transaction's normal costs.
   */
  memo?: MemoInput | undefined
}
export type UnfreezeBalanceReturnType = BuildAndBroadcastReturnType

export type UnfreezeBalanceErrorType =
  | AccountNotFoundErrorType
  | BuildAndBroadcastErrorType
  | ParseAccountErrorType
  | ResourceCodeOfErrorType
  | ToHexErrorType
  | ErrorType

export type BuildUnfreezeBalanceParameters = UnfreezeBalanceParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildUnfreezeBalanceReturnType = BuildTransactionReturnType

export type BuildUnfreezeBalanceErrorType =
  | AccountNotFoundErrorType
  | BuildTransactionErrorType
  | ParseAccountErrorType
  | ResourceCodeOfErrorType
  | ToHexErrorType
  | ErrorType

/** The signing account plus the assembled `UnfreezeBalanceContract`. */
function assemble(
  client: Client,
  parameters: UnfreezeBalanceParameters,
): { account: TronAccount; contract: RawContract } {
  const { resource, receiverAddress } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: UnfreezeBalanceContract = {
    owner_address: toHex(account.address),
    resource: resourceCodeOf(resource),
  }
  if (receiverAddress !== undefined)
    value.receiver_address = toHex(receiverAddress)

  const contract: RawContract = {
    type: ContractType.UnfreezeBalanceContract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}UnfreezeBalanceContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `UnfreezeBalanceContract` transaction (§ type 12,
 * Stake 1.0) and returns it in java-tron's HTTP JSON shape (TronWeb-compatible
 * `{ visible, txID, raw_data, raw_data_hex }`) — the build half of
 * {@link unfreezeBalance}, without signing or broadcasting. Pass `permissionId`
 * to bind it to an active/owner permission. The node is used only to fetch the
 * latest block (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Resource, optional account/receiver/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildUnfreezeBalance(
  client: Client,
  parameters: BuildUnfreezeBalanceParameters,
): Promise<BuildUnfreezeBalanceReturnType> {
  const { contract } = assemble(client, parameters)
  return buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
    expirationMs: parameters.expirationMs,
    memo: parameters.memo,
  })
}

/**
 * Unstakes (unfreezes) TRX previously frozen under Stake 1.0 by locally
 * building, signing and broadcasting an `UnfreezeBalanceContract` (§ type 12).
 *
 * @param client The Client to use.
 * @param parameters Resource, optional account/receiver/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function unfreezeBalance(
  client: Client,
  parameters: UnfreezeBalanceParameters,
): Promise<UnfreezeBalanceReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
    expirationMs: parameters.expirationMs,
    memo: parameters.memo,
  })
}
