// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import { AccountNotFoundError } from '../../errors/rpc.js'
import { parseAccount } from '../../types/account.js'
import type { Address } from '../../types/address.js'
import type { Hex } from '../../types/misc.js'
import { toHex } from '../../utils/address/toHex.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../utils/transaction/registry.js'
import type { RawContract } from '../../utils/transaction/serializeRawData.js'
import {
  type DelegateResourceContract,
  ResourceCode,
} from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'

/** Resource type delegatable under Stake 2.0. */
export type DelegateResource = 'BANDWIDTH' | 'ENERGY'

export type DelegateResourceParameters = {
  /** The signing (delegator) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Recipient of the delegated resource. */
  receiverAddress: Address
  /** Amount to delegate, in SUN. */
  balance: bigint
  /** Resource delegated. */
  resource: DelegateResource
  /** Whether the delegation is locked (cannot be undelegated until unlock). */
  lock?: boolean | undefined
  /** Lock period, in blocks (only meaningful when `lock` is true). */
  lockPeriod?: bigint | undefined
  /** Injectable clock (ms since epoch) for deterministic tests. */
  now?: bigint | undefined
}
export type DelegateResourceReturnType = BuildAndBroadcastReturnType

/**
 * Delegates staked bandwidth or energy to another account under Stake 2.0 by
 * locally building, signing and broadcasting a `DelegateResourceContract`
 * (§ type 57).
 *
 * @param client The Client to use.
 * @param parameters Receiver, amount, resource, optional lock/account/clock.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function delegateResource(
  client: Client,
  parameters: DelegateResourceParameters,
): Promise<DelegateResourceReturnType> {
  const { receiverAddress, balance, resource, lock, lockPeriod } = parameters

  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const now = parameters.now ?? BigInt(Date.now())

  const value: DelegateResourceContract = {
    ownerAddress: toHex(account.address),
    resource: ResourceCode[resource],
    balance,
    receiverAddress: toHex(receiverAddress),
  }
  if (lock !== undefined) value.lock = lock
  if (lockPeriod !== undefined) value.lockPeriod = lockPeriod

  const contract: RawContract = {
    type: ContractType.DelegateResourceContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}DelegateResourceContract`,
      value,
    },
  }

  return buildAndBroadcast(client, { contract, account, now })
}
