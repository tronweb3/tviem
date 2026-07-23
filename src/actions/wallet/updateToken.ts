// TRON-specific, clean-room implementation for @tronweb3/omni.
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
import type {
  FlexInput,
  UpdateAssetContract,
} from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
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

export type BuildUpdateTokenParameters = UpdateTokenParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildUpdateTokenReturnType = NodeTransaction

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
    ownerAddress: toHex(account.address),
    description,
    url,
    newLimit,
    newPublicLimit,
  }

  const contract: RawContract = {
    type: ContractType.UpdateAssetContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}UpdateAssetContract`,
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
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildUpdateToken(
  client: Client,
  parameters: BuildUpdateTokenParameters,
): Promise<BuildUpdateTokenReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
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
