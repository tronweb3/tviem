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
  type AccountPermissionUpdateContract,
  type Permission,
  PermissionType,
} from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'

export type AccountPermissionUpdateParameters = {
  /** The account whose permissions are being updated (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** The new owner permission (its `type` is forced to `OWNER`). */
  owner?: Permission | undefined
  /** The new witness/SR permission (its `type` is forced to `WITNESS`). */
  witness?: Permission | undefined
  /** The new active permissions (each `type` is forced to `ACTIVE`). */
  actives?: Permission[] | undefined
  /** Energy/bandwidth fee ceiling in SUN (`raw_data.fee_limit`). */
  feeLimit?: bigint | undefined
  /** Injectable clock (ms since epoch) for deterministic tests. */
  now?: bigint | undefined
}
export type AccountPermissionUpdateReturnType = BuildAndBroadcastReturnType

/**
 * Updates an account's owner / witness / active permissions by locally
 * building, signing and broadcasting an `AccountPermissionUpdateContract`
 * (§ type 46) — the multi-sig setup step. Each permission's `type` is set from
 * the slot it is passed in (`owner` → OWNER, `witness` → WITNESS, `actives` →
 * ACTIVE), so callers only supply `threshold`, `keys` (`{ address, weight }`),
 * an optional `permissionName`, and — for active permissions — the 32-byte
 * `operations` bitmap of allowed contract types.
 *
 * @param client The Client to use.
 * @param parameters The new permission set, optional account/fee/clock.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function accountPermissionUpdate(
  client: Client,
  parameters: AccountPermissionUpdateParameters,
): Promise<AccountPermissionUpdateReturnType> {
  const { owner, witness, actives, feeLimit } = parameters

  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const now = parameters.now ?? BigInt(Date.now())

  const value: AccountPermissionUpdateContract = {
    ownerAddress: toHex(account.address),
    ...(owner ? { owner: { ...owner, type: PermissionType.OWNER } } : {}),
    ...(witness
      ? { witness: { ...witness, type: PermissionType.WITNESS } }
      : {}),
    ...(actives
      ? { actives: actives.map((a) => ({ ...a, type: PermissionType.ACTIVE })) }
      : {}),
  }

  const contract: RawContract = {
    type: ContractType.AccountPermissionUpdateContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}AccountPermissionUpdateContract`,
      value,
    },
  }

  return buildAndBroadcast(client, { contract, account, now, feeLimit })
}
