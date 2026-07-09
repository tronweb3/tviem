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

export type WithdrawExpireUnfreezeParameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Injectable clock (ms since epoch) for deterministic tests. */
  now?: bigint | undefined
}
export type WithdrawExpireUnfreezeReturnType = BuildAndBroadcastReturnType

/**
 * Withdraws all Stake 2.0 unfrozen balances whose 14-day window has elapsed,
 * releasing them back to the spendable balance, by locally building, signing
 * and broadcasting a `WithdrawExpireUnfreezeContract` (§ type 56). Carries only
 * the owner address.
 *
 * @param client The Client to use.
 * @param parameters Optional account/clock.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function withdrawExpireUnfreeze(
  client: Client,
  parameters: WithdrawExpireUnfreezeParameters = {},
): Promise<WithdrawExpireUnfreezeReturnType> {
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const now = parameters.now ?? BigInt(Date.now())

  const contract: RawContract = {
    type: ContractType.WithdrawExpireUnfreezeContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}WithdrawExpireUnfreezeContract`,
      value: {
        ownerAddress: toHex(account.address),
      },
    },
  }

  return buildAndBroadcast(client, { contract, account, now })
}
