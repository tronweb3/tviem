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
import type { ClearABIContract } from '../../utils/transaction/types.js'
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

export type ClearAbiParameters = {
  /** The signing (deployer/owner) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Contract whose ABI is being cleared. */
  contractAddress: Address
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type ClearAbiReturnType = BuildAndBroadcastReturnType

export type ClearAbiErrorType =
  | AccountNotFoundErrorType
  | BuildAndBroadcastErrorType
  | ParseAccountErrorType
  | ToHexErrorType
  | ErrorType

export type BuildClearAbiParameters = ClearAbiParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildClearAbiReturnType = BuildTransactionReturnType

export type BuildClearAbiErrorType =
  | AccountNotFoundErrorType
  | BuildTransactionErrorType
  | ParseAccountErrorType
  | ToHexErrorType
  | ErrorType

/** The signing account plus the assembled `ClearABIContract`. */
function assemble(
  client: Client,
  parameters: ClearAbiParameters,
): { account: TronAccount; contract: RawContract } {
  const { contractAddress } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: ClearABIContract = {
    owner_address: toHex(account.address),
    contract_address: toHex(contractAddress),
  }

  const contract: RawContract = {
    type: ContractType.ClearABIContract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}ClearABIContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `ClearABIContract` transaction (§ type 48) and returns
 * it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible, txID,
 * raw_data, raw_data_hex }`) — the build half of {@link clearAbi}, without
 * signing or broadcasting. Pass `permissionId` to bind it to an active/owner
 * permission. The node is used only to fetch the latest block (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Contract address, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildClearAbi(
  client: Client,
  parameters: BuildClearAbiParameters,
): Promise<BuildClearAbiReturnType> {
  const { contract } = assemble(client, parameters)
  return buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
}

/**
 * Clears a smart contract's on-chain ABI by locally building, signing and
 * broadcasting a `ClearABIContract` (§ type 48).
 *
 * @param client The Client to use.
 * @param parameters Contract address, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function clearAbi(
  client: Client,
  parameters: ClearAbiParameters,
): Promise<ClearAbiReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
