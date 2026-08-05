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
  type FlexErrorType,
  type FlexInput,
  flexToHex,
} from '../../utils/transaction/normalize.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../utils/transaction/registry.js'
import type { RawContract } from '../../utils/transaction/serializeRawData.js'
import type { UpdateAssetContract } from '../../utils/transaction/types.js'
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

export type UpdateTokenParameters = {
  /** The signing (issuer) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** New token description (dual string/hex form). */
  description: FlexInput
  /** New token website URL (dual string/hex form). */
  url: FlexInput
  /** New per-holder free bandwidth. */
  newLimit: bigint
  /** New total free bandwidth. */
  newPublicLimit: bigint
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type UpdateTokenReturnType = BuildAndBroadcastReturnType

export type UpdateTokenErrorType =
  | AccountNotFoundErrorType
  | BuildAndBroadcastErrorType
  | FlexErrorType
  | ParseAccountErrorType
  | ToHexErrorType
  | ErrorType

export type BuildUpdateTokenParameters = UpdateTokenParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildUpdateTokenReturnType = BuildTransactionReturnType

export type BuildUpdateTokenErrorType =
  | AccountNotFoundErrorType
  | BuildTransactionErrorType
  | FlexErrorType
  | ParseAccountErrorType
  | ToHexErrorType
  | ErrorType

/** The signing account plus the assembled `UpdateAssetContract`. */
function assemble(
  client: Client,
  parameters: UpdateTokenParameters,
): { account: TronAccount; contract: RawContract } {
  const { description, url, newLimit, newPublicLimit } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: UpdateAssetContract = {
    owner_address: toHex(account.address),
    description: flexToHex(description),
    url: flexToHex(url),
    new_limit: newLimit,
    new_public_limit: newPublicLimit,
  }

  const contract: RawContract = {
    type: ContractType.UpdateAssetContract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}UpdateAssetContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `UpdateAssetContract` transaction (§ type 15) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link updateToken},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Description, url, limits, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildUpdateToken(
  client: Client,
  parameters: BuildUpdateTokenParameters,
): Promise<BuildUpdateTokenReturnType> {
  const { contract } = assemble(client, parameters)
  return buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
}

/**
 * Updates a TRC10 token's description, URL and free-bandwidth settings by
 * locally building, signing and broadcasting an `UpdateAssetContract`
 * (§ type 15).
 *
 * @param client The Client to use.
 * @param parameters Description, url, limits, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function updateToken(
  client: Client,
  parameters: UpdateTokenParameters,
): Promise<UpdateTokenReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
