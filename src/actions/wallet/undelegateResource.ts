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
  ResourceCode,
  type UnDelegateResourceContract,
} from '../../utils/transaction/types.js'
import type { DelegateResource } from './delegateResource.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'

export type UndelegateResourceParameters = {
  /** The signing (delegator) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Account the resource was delegated to. */
  receiverAddress: Address
  /** Amount to undelegate, in SUN. */
  balance: bigint
  /** Resource undelegated. */
  resource: DelegateResource
  /** Injectable clock (ms since epoch) for deterministic tests. */
  now?: bigint | undefined
}
export type UndelegateResourceReturnType = BuildAndBroadcastReturnType

/**
 * Reclaims resource previously delegated to another account under Stake 2.0 by
 * locally building, signing and broadcasting an `UnDelegateResourceContract`
 * (§ type 58).
 *
 * @param client The Client to use.
 * @param parameters Receiver, amount, resource, optional account/clock.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function undelegateResource(
  client: Client,
  parameters: UndelegateResourceParameters,
): Promise<UndelegateResourceReturnType> {
  const { receiverAddress, balance, resource } = parameters

  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const now = parameters.now ?? BigInt(Date.now())

  const value: UnDelegateResourceContract = {
    ownerAddress: toHex(account.address),
    resource: ResourceCode[resource],
    balance,
    receiverAddress: toHex(receiverAddress),
  }

  const contract: RawContract = {
    type: ContractType.UnDelegateResourceContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}UnDelegateResourceContract`,
      value,
    },
  }

  return buildAndBroadcast(client, { contract, account, now })
}
