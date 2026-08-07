import type { SignableTransaction } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import type { RequestErrorType } from '../../clients/transports/http.js'
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { TransactionTamperedErrorType } from '../../errors/rpc.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Address, AddressInput } from '../../types/address.js'
import type { Hex } from '../../types/misc.js'
import {
  type ToBase58ErrorType,
  toBase58,
} from '../../utils/address/toBase58.js'
import { assertUnchangedTransaction } from '../utils/assertUnchangedTransaction.js'
import { recoverEchoedResultBody } from '../utils/recoverMultisigResult.js'

/** The permission a multi-sig transaction is being evaluated against. */
export type SignWeightPermission = {
  type?: number | undefined
  id?: number | undefined
  permissionName?: string | undefined
  threshold: bigint
  operations?: Hex | undefined
  keys: { address: Address; weight: bigint }[]
}

export type GetSignWeightParameters = {
  /** A locally built (and typically partially-signed) transaction. */
  transaction: SignableTransaction
}

export type GetSignWeightReturnType = {
  /** Accumulated signature weight so far. */
  currentWeight: bigint
  /** Addresses (Base58Check) that have already signed. */
  approvedList: Address[]
  /** The evaluated permission (threshold, keys, operations). */
  permission?: SignWeightPermission | undefined
  /** The node's result status (e.g. `NOT_ENOUGH_PERMISSION` while collecting). */
  result?:
    | { code?: string | undefined; message?: string | undefined }
    | undefined
  /** The **local** transaction, re-verified against the node's echoed copy. */
  transaction: SignableTransaction
}

export type GetSignWeightErrorType =
  | BaseErrorType
  | RequestErrorType
  | ToBase58ErrorType
  | TransactionTamperedErrorType
  | ErrorType

type RawKey = {
  address?: string | undefined
  weight?: number | string | undefined
}
/** The raw node-JSON permission shape (`getsignweight` / `getaccount`). */
export type RawPermission = {
  type?: number | string | undefined
  id?: number | undefined
  permission_name?: string | undefined
  threshold?: number | string | undefined
  operations?: string | undefined
  keys?: RawKey[] | undefined
}
type RawSignWeight = {
  result?:
    | { code?: string | undefined; message?: string | undefined }
    | undefined
  permission?: RawPermission | undefined
  approved_list?: string[] | undefined
  current_weight?: number | string | undefined
  transaction?:
    | { transaction?: { txID?: string; raw_data_hex?: string } | undefined }
    | undefined
}

function toPermissionType(type: unknown): number | undefined {
  if (typeof type === 'number') return type
  // proto3 JSON omits default enum values: an absent type IS Owner (0).
  if (type === undefined) return 0
  if (type === 'Owner') return 0
  if (type === 'Witness') return 1
  if (type === 'Active') return 2
  return undefined
}

/** Formats a raw node-JSON permission (keys → Base58, threshold → bigint). */
export function formatPermission(
  permission: RawPermission,
): SignWeightPermission {
  return {
    type: toPermissionType(permission.type),
    id: permission.id,
    permissionName: permission.permission_name,
    threshold: BigInt(permission.threshold ?? 0),
    ...(permission.operations
      ? { operations: `0x${permission.operations}` as Hex }
      : {}),
    keys: (permission.keys ?? []).map((key) => ({
      address: toBase58((key.address ?? '') as AddressInput),
      weight: BigInt(key.weight ?? 0),
    })),
  }
}

/**
 * Reads the accumulated signature weight of a multi-sig transaction against its
 * permission via `getsignweight` (full node): how much weight has signed so
 * far, the threshold + keys of the evaluated permission, and who has approved.
 *
 * Node echo: the node echoes the submitted transaction back; this asserts that
 * echoed transaction matches the local one byte-for-byte and throws
 * {@link TransactionTamperedError} on any mismatch — and always returns the
 * **local** transaction, never the node's copy.
 *
 * @param client The Client to use.
 * @param parameters `transaction` — the built transaction to weigh.
 * @returns `{ currentWeight, approvedList, permission, result, transaction }`.
 */
export async function getSignWeight(
  client: Client,
  { transaction }: GetSignWeightParameters,
): Promise<GetSignWeightReturnType> {
  if (!transaction.raw_data_hex || !transaction.txID)
    throw new BaseError(
      'getSignWeight requires a built transaction carrying `raw_data_hex` and `txID` (sign or multiSign it first).',
    )

  // A `NOT_ENOUGH_PERMISSION` result is a normal collecting state that the
  // generic normalizer rejects; recover the body when that happens.
  let response: RawSignWeight
  try {
    response = await client.request<RawSignWeight>({
      node: 'full',
      path: 'getsignweight',
      method: 'POST',
      body: {
        txID: transaction.txID,
        // Node dialect: these endpoints rebuild the transaction from the
        // snake_case raw_data JSON (raw_data_hex is ignored server-side).
        raw_data: transaction.raw_data,
        raw_data_hex: transaction.raw_data_hex,
        signature: transaction.signature ?? [],
      },
    })
  } catch (error) {
    const recovered = recoverEchoedResultBody(error)
    if (!recovered) throw error
    response = recovered as RawSignWeight
  }

  assertUnchangedTransaction(transaction, response.transaction?.transaction, {
    path: 'getsignweight',
  })

  return {
    currentWeight: BigInt(response.current_weight ?? 0),
    approvedList: (response.approved_list ?? []).map((address) =>
      toBase58(address as AddressInput),
    ),
    ...(response.permission
      ? { permission: formatPermission(response.permission) }
      : {}),
    ...(response.result ? { result: response.result } : {}),
    transaction,
  }
}
