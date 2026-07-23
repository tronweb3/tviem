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
  type NodeTransaction,
  toNodeTransaction,
} from '../../utils/transaction/toNodeTransaction.js'
import {
  type DelegateResourceContract,
  ResourceCode,
} from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

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
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type DelegateResourceReturnType = BuildAndBroadcastReturnType

export type BuildDelegateResourceParameters = DelegateResourceParameters & {
  /**
   * Multi-sig permission id (`Contract.Permission_id`) to bind the transaction
   * to an active/owner permission.
   */
  permissionId?: number | undefined
}
export type BuildDelegateResourceReturnType = NodeTransaction

/** The signing (delegator) account plus the assembled `DelegateResourceContract`. */
function assemble(
  client: Client,
  parameters: DelegateResourceParameters,
): { account: TronAccount; contract: RawContract } {
  const { receiverAddress, balance, resource, lock, lockPeriod } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

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

  return { account, contract }
}

/**
 * Builds an **unsigned** `DelegateResourceContract` transaction (§ type 57) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link delegateResource},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Receiver, amount, resource, optional lock/account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildDelegateResource(
  client: Client,
  parameters: BuildDelegateResourceParameters,
): Promise<BuildDelegateResourceReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Delegates staked bandwidth or energy to another account under Stake 2.0 by
 * locally building, signing and broadcasting a `DelegateResourceContract`
 * (§ type 57).
 *
 * @param client The Client to use.
 * @param parameters Receiver, amount, resource, optional lock/account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function delegateResource(
  client: Client,
  parameters: DelegateResourceParameters,
): Promise<DelegateResourceReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, { contract, account, blockHeader: parameters.blockHeader })
}
