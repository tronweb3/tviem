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
import { ResourceCode } from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

/** Resource type stakeable under Stake 2.0. */
export type StakeResource = 'BANDWIDTH' | 'ENERGY'

export type FreezeBalanceV2Parameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Amount to freeze, in SUN. */
  frozenBalance: bigint
  /** Resource obtained by freezing. */
  resource: StakeResource
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type FreezeBalanceV2ReturnType = BuildAndBroadcastReturnType

export type BuildFreezeBalanceV2Parameters = FreezeBalanceV2Parameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildFreezeBalanceV2ReturnType = NodeTransaction

/** The signing account plus the assembled `FreezeBalanceV2Contract`. */
function assemble(
  client: Client,
  parameters: FreezeBalanceV2Parameters,
): { account: TronAccount; contract: RawContract } {
  const { frozenBalance, resource } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  // Build the FreezeBalanceV2Contract (addresses enter the body as 41-hex).
  const contract: RawContract = {
    type: ContractType.FreezeBalanceV2Contract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}FreezeBalanceV2Contract`,
      value: {
        ownerAddress: toHex(account.address),
        frozenBalance,
        resource: ResourceCode[resource],
      },
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `FreezeBalanceV2Contract` transaction (§ type 54) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link freezeBalanceV2},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Amount, resource, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildFreezeBalanceV2(
  client: Client,
  parameters: BuildFreezeBalanceV2Parameters,
): Promise<BuildFreezeBalanceV2ReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Stakes (freezes) TRX for bandwidth or energy under Stake 2.0 by locally
 * building, signing and broadcasting a `FreezeBalanceV2Contract` (§ type 54).
 *
 * @param client The Client to use.
 * @param parameters Amount, resource, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function freezeBalanceV2(
  client: Client,
  parameters: FreezeBalanceV2Parameters,
): Promise<FreezeBalanceV2ReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
