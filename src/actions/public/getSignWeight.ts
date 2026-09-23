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
import {
  type CloneTransactionErrorType,
  cloneTransaction,
} from '../../utils/transaction/cloneTransaction.js'
import { assertUnchangedTransaction } from '../utils/assertUnchangedTransaction.js'
import {
  type CanonicalizeTransactionErrorType,
  canonicalizeTransaction,
} from '../utils/canonicalizeTransaction.js'
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
  /**
   * The node's verdict: `NOT_ENOUGH_PERMISSION` while signatures are still
   * being collected, or `ENOUGH_PERMISSION` (proto3 omits it, as the default,
   * so `result` is then empty or absent). Failure codes never land here — they
   * throw.
   */
  result?:
    | { code?: string | undefined; message?: string | undefined }
    | undefined
  /**
   * The **local** transaction — a snapshot taken on entry, which is what was
   * sent and what the node's echoed copy was verified against. Its `raw_data`
   * is in the canonical node-JSON shape, whatever spelling the caller passed.
   */
  transaction: SignableTransaction
}

export type GetSignWeightErrorType =
  | BaseErrorType
  | CanonicalizeTransactionErrorType
  | CloneTransactionErrorType
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
 * The node rebuilds the transaction from the `raw_data` JSON, read as
 * java-tron's `visible: false` rendering, so the triple is integrity-checked
 * first and `raw_data` is sent as the canonical rendering of the checked bytes
 * (see {@link canonicalizeTransaction}) — a `visible: true` rendering, which
 * signing accepts, is weighed like any other, and an inconsistent triple is
 * refused before any request.
 *
 * A failure verdict — `PERMISSION_ERROR` (a key outside the permission, a
 * wrong `Permission_id`), `SIGNATURE_FORMAT_ERROR`, `COMPUTE_ADDRESS_ERROR`,
 * `OTHER_ERROR` — throws the transport's `TronContractValidateError`, carrying
 * the node's `code` and message. It is never read as zero weight: java-tron
 * echoes the transaction on those branches too, so the echo cannot tell a
 * failure from a verdict; only the code can.
 *
 * @param client The Client to use.
 * @param parameters `transaction` — the built transaction to weigh.
 * @returns `{ currentWeight, approvedList, permission, result, transaction }`.
 */
export async function getSignWeight(
  client: Client,
  parameters: GetSignWeightParameters,
): Promise<GetSignWeightReturnType> {
  // Snapshot once, like the sign and broadcast paths: the guard below, the
  // request body and the echo assertion are three separate reads of the
  // caller's object with an `await` between the last two. Read live, the
  // assertion would compare the node's echo against whatever the object says
  // by then rather than against what was sent — accusing an honest node, or
  // passing a forged echo the object has come to match.
  const snapshot = cloneTransaction(parameters.transaction)

  if (!snapshot.raw_data_hex || !snapshot.txID)
    throw new BaseError(
      'getSignWeight requires a built transaction carrying `raw_data_hex` and `txID` (sign or multiSign it first).',
    )

  // The same relay boundary as broadcast: the node rebuilds the transaction
  // from `raw_data`, read as `visible: false` JSON. The triple is checked and
  // `raw_data` re-derived from the checked bytes, so a spelling the signing
  // paths accept but the node does not (Base58, `0x` EVM, raw bytes) is never
  // sent verbatim — and a drifted model is refused here rather than weighed
  // by the node and reported back as a tampered echo.
  const transaction = canonicalizeTransaction(snapshot)

  // `NOT_ENOUGH_PERMISSION` is a normal collecting state. A real node reports
  // it as `code` alone, which the transport passes through; should a `message`
  // ride along (a proxy, a mock), the transport's Form 2 check rejects the
  // body and it is recovered here — by code only. Every other code is a
  // failure and is rethrown, echoed transaction or not.
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
    const recovered = recoverEchoedResultBody(error, {
      okCodes: ['ENOUGH_PERMISSION', 'NOT_ENOUGH_PERMISSION'],
    })
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
