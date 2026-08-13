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
import type { UpdateEnergyLimitContract } from '../../utils/transaction/types.js'
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
export type UpdateEnergyLimitReturnType = BuildAndBroadcastReturnType

export type UpdateEnergyLimitErrorType =
  | AccountNotFoundErrorType
  | BuildAndBroadcastErrorType
  | ParseAccountErrorType
  | ToHexErrorType
  | ErrorType

export type BuildUpdateEnergyLimitParameters = UpdateEnergyLimitParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildUpdateEnergyLimitReturnType = BuildTransactionReturnType

export type BuildUpdateEnergyLimitErrorType =
  | AccountNotFoundErrorType
  | BuildTransactionErrorType
  | ParseAccountErrorType
  | ToHexErrorType
  | ErrorType

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
    expirationMs: parameters.expirationMs,
    memo: parameters.memo,
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
    expirationMs: parameters.expirationMs,
    memo: parameters.memo,
  })
}
