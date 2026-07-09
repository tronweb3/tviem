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
import { ResourceCode } from '../../utils/transaction/types.js'
import type { StakeResource } from './freezeBalanceV2.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'

export type UnfreezeBalanceV2Parameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Amount to unfreeze, in SUN. */
  unfreezeBalance: bigint
  /** Resource previously frozen. */
  resource: StakeResource
  /** Injectable clock (ms since epoch) for deterministic tests. */
  now?: bigint | undefined
}
export type UnfreezeBalanceV2ReturnType = BuildAndBroadcastReturnType

/**
 * Unstakes (unfreezes) TRX previously frozen for bandwidth or energy under
 * Stake 2.0 by locally building, signing and broadcasting an
 * `UnfreezeBalanceV2Contract` (§ type 55). The unfrozen amount enters a 14-day
 * withdrawal window, after which `withdrawExpireUnfreeze` releases it.
 *
 * @param client The Client to use.
 * @param parameters Amount, resource, optional account/clock.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function unfreezeBalanceV2(
  client: Client,
  parameters: UnfreezeBalanceV2Parameters,
): Promise<UnfreezeBalanceV2ReturnType> {
  const { unfreezeBalance, resource } = parameters

  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const now = parameters.now ?? BigInt(Date.now())

  const contract: RawContract = {
    type: ContractType.UnfreezeBalanceV2Contract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}UnfreezeBalanceV2Contract`,
      value: {
        ownerAddress: toHex(account.address),
        unfreezeBalance,
        resource: ResourceCode[resource],
      },
    },
  }

  return buildAndBroadcast(client, { contract, account, now })
}
