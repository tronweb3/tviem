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
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'

export type CancelAllUnfreezeV2Parameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Injectable clock (ms since epoch) for deterministic tests. */
  now?: bigint | undefined
}
export type CancelAllUnfreezeV2ReturnType = BuildAndBroadcastReturnType

/**
 * Cancels all pending Stake 2.0 unfreeze requests, re-staking their amounts,
 * by locally building, signing and broadcasting a `CancelAllUnfreezeV2Contract`
 * (§ type 59). Carries only the owner address.
 *
 * @param client The Client to use.
 * @param parameters Optional account/clock.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function cancelAllUnfreezeV2(
  client: Client,
  parameters: CancelAllUnfreezeV2Parameters = {},
): Promise<CancelAllUnfreezeV2ReturnType> {
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const now = parameters.now ?? BigInt(Date.now())

  const contract: RawContract = {
    type: ContractType.CancelAllUnfreezeV2Contract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}CancelAllUnfreezeV2Contract`,
      value: {
        ownerAddress: toHex(account.address),
      },
    },
  }

  return buildAndBroadcast(client, { contract, account, now })
}
