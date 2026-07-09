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
import type { WithdrawBalanceContract } from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'

export type WithdrawBalanceParameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Injectable clock (ms since epoch) for deterministic tests. */
  now?: bigint | undefined
}
export type WithdrawBalanceReturnType = BuildAndBroadcastReturnType

/**
 * Withdraws accrued staking/voting rewards to the account's spendable balance
 * by locally building, signing and broadcasting a `WithdrawBalanceContract`
 * (§ type 13).
 *
 * @param client The Client to use.
 * @param parameters Optional account/clock.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function withdrawBalance(
  client: Client,
  parameters: WithdrawBalanceParameters = {},
): Promise<WithdrawBalanceReturnType> {
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const now = parameters.now ?? BigInt(Date.now())

  const value: WithdrawBalanceContract = {
    ownerAddress: toHex(account.address),
  }

  const contract: RawContract = {
    type: ContractType.WithdrawBalanceContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}WithdrawBalanceContract`,
      value,
    },
  }

  return buildAndBroadcast(client, { contract, account, now })
}
