import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import { BaseError, type BaseErrorType } from '../../errors/base.js'
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
import {
  type AddressToHexErrorType,
  addressToHex,
} from '../../utils/address/addressToHex.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../utils/transaction/registry.js'
import type { RawContract } from '../../utils/transaction/serializeRawData.js'
import type { UpdateSettingContract } from '../../utils/transaction/types.js'
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
export type UpdateSettingReturnType = BuildAndBroadcastReturnType

export type UpdateSettingErrorType =
  | AccountNotFoundErrorType
  | BaseErrorType
  | BuildAndBroadcastErrorType
  | ParseAccountErrorType
  | AddressToHexErrorType
  | ErrorType

export type BuildUpdateSettingParameters = UpdateSettingParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildUpdateSettingReturnType = BuildTransactionReturnType

export type BuildUpdateSettingErrorType =
  | AccountNotFoundErrorType
  | BaseErrorType
  | BuildTransactionErrorType
  | ParseAccountErrorType
  | AddressToHexErrorType
  | ErrorType

/** The signing account plus the assembled `UpdateSettingContract`. */
function assemble(
  client: Client,
  parameters: UpdateSettingParameters,
): { account: TronAccount; contract: RawContract } {
  const { contractAddress, consumeUserResourcePercent } = parameters

  // `UpdateSettingContractActuator.validate()` rejects anything outside
  // [0, 100] ("percent not in [0, 100]"), so an out-of-range value would
  // sign a doomed transaction.
  if (consumeUserResourcePercent < 0n || consumeUserResourcePercent > 100n)
    throw new BaseError(
      `Invalid consumeUserResourcePercent: ${consumeUserResourcePercent}. Expected a percentage in [0, 100].`,
    )

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: UpdateSettingContract = {
    owner_address: addressToHex(account.address),
    contract_address: addressToHex(contractAddress),
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
 * returns it in java-tron's HTTP JSON shape (`{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link updateSetting},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Contract address, resource percent, optional account/permissionId/blockHeader.
 * @returns An unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildUpdateSetting(
  client: Client,
  parameters: BuildUpdateSettingParameters,
): Promise<BuildUpdateSettingReturnType> {
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
 * Updates a smart contract's user resource-consumption percentage by locally
 * building, signing and broadcasting an `UpdateSettingContract` (§ type 33).
 *
 * @param client The Client to use.
 * @param parameters Contract address, resource percent, optional account/blockHeader.
 * @returns `{ txID, result, code, message }` — the locally computed
 * transaction id plus the node's acknowledgement fields, when echoed.
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
    expirationMs: parameters.expirationMs,
    memo: parameters.memo,
  })
}
