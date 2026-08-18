import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import {
  AccountNotFoundError,
  type AccountNotFoundErrorType,
} from '../../errors/rpc.js'
import type { ErrorType } from '../../errors/utils.js'
import {
  type ParseAccountErrorType,
  parseAccount,
} from '../../types/account.js'
import type { Hex } from '../../types/misc.js'
import {
  type AddressToHexErrorType,
  addressToHex,
} from '../../utils/address/addressToHex.js'
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
  type BuildAndBroadcastErrorType,
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  type BuildTransactionErrorType,
  type BuildTransactionReturnType,
  buildTransaction,
  type MemoInput,
  type TransactionHeader,
} from './utils/buildTransaction.js'

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
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
  /**
   * Transaction lifetime in ms, applied to the chain-derived timestamp
   * (`expiration = refBlock.timestamp + expirationMs`). Positive integer,
   * at most 86_400_000 (24h). Ignored when a complete `blockHeader` is
   * supplied. @default 60_000
   */
  expirationMs?: bigint | number | undefined
  /**
   * Optional memo written to `raw_data.data` (hex or raw bytes). Enters the
   * signed bytes; the chain charges a memo fee (`getMemoFee`, 1 TRX on
   * mainnet and Nile) on top of the transaction's normal costs.
   */
  memo?: MemoInput | undefined
}
export type AccountPermissionUpdateReturnType = BuildAndBroadcastReturnType

export type AccountPermissionUpdateErrorType =
  | AccountNotFoundErrorType
  | BuildAndBroadcastErrorType
  | ParseAccountErrorType
  | AddressToHexErrorType
  | ErrorType

export type BuildAccountPermissionUpdateParameters =
  AccountPermissionUpdateParameters & {
    /** Multi-sig permission id (`Contract.Permission_id`). */
    permissionId?: number | undefined
  }
export type BuildAccountPermissionUpdateReturnType = BuildTransactionReturnType

export type BuildAccountPermissionUpdateErrorType =
  | AccountNotFoundErrorType
  | BuildTransactionErrorType
  | ParseAccountErrorType
  | AddressToHexErrorType
  | ErrorType

/** The signing account plus the assembled `AccountPermissionUpdateContract` and `fee_limit`. */
function assemble(
  client: Client,
  parameters: AccountPermissionUpdateParameters,
): {
  account: TronAccount
  contract: RawContract
  feeLimit: bigint | undefined
} {
  const { owner, witness, actives, feeLimit } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  // Each permission's `type` is forced from the slot it was passed in.
  const value: AccountPermissionUpdateContract = {
    owner_address: addressToHex(account.address),
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
      type_url: `${contractTypeUrlPrefix}AccountPermissionUpdateContract`,
      value,
    },
  }

  return { account, contract, feeLimit }
}

/**
 * Builds an **unsigned** `AccountPermissionUpdateContract` transaction
 * (§ type 46) and returns it in java-tron's HTTP JSON shape (TronWeb-compatible
 * `{ visible, txID, raw_data, raw_data_hex }`) — the build half of
 * {@link accountPermissionUpdate}, without signing or broadcasting. Pass
 * `permissionId` to bind it to an active/owner permission. The node is used only
 * to fetch the latest block (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters The new permission set, optional account/fee/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildAccountPermissionUpdate(
  client: Client,
  parameters: BuildAccountPermissionUpdateParameters,
): Promise<BuildAccountPermissionUpdateReturnType> {
  const { contract, feeLimit } = assemble(client, parameters)
  return buildTransaction(client, {
    contract,
    feeLimit,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
    expirationMs: parameters.expirationMs,
    memo: parameters.memo,
  })
}

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
 * @param parameters The new permission set, optional account/fee/blockHeader.
 * @returns `{ txID, result, code, message }` — the locally computed
 * transaction id plus the node's acknowledgement fields, when echoed.
 */
export async function accountPermissionUpdate(
  client: Client,
  parameters: AccountPermissionUpdateParameters,
): Promise<AccountPermissionUpdateReturnType> {
  const { account, contract, feeLimit } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    feeLimit,
    blockHeader: parameters.blockHeader,
    expirationMs: parameters.expirationMs,
    memo: parameters.memo,
  })
}
