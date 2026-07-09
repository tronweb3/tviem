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
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'

/** Resource type stakeable under Stake 2.0. */
export type StakeResource = 'BANDWIDTH' | 'ENERGY'

export type FreezeBalanceV2Parameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Amount to freeze, in SUN. */
  frozenBalance: bigint
  /** Resource obtained by freezing. */
  resource: StakeResource
  /** Injectable clock (ms since epoch) for deterministic tests. */
  now?: bigint | undefined
}
export type FreezeBalanceV2ReturnType = BuildAndBroadcastReturnType

/**
 * Stakes (freezes) TRX for bandwidth or energy under Stake 2.0 by locally
 * building, signing and broadcasting a `FreezeBalanceV2Contract` (§ type 54).
 *
 * @param client The Client to use.
 * @param parameters Amount, resource, optional account/clock.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function freezeBalanceV2(
  client: Client,
  parameters: FreezeBalanceV2Parameters,
): Promise<FreezeBalanceV2ReturnType> {
  const { frozenBalance, resource } = parameters

  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const now = parameters.now ?? BigInt(Date.now())

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

  return buildAndBroadcast(client, { contract, account, now })
}
