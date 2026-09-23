import type { AccountKey, TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import {
  AccountNotFoundError,
  type AccountNotFoundErrorType,
} from '../../errors/rpc.js'
import type { ErrorType } from '../../errors/utils.js'
import {
  type ParseAccountErrorType,
  parseAccount,
} from '../../types/account.js'
import {
  type AddressToHexErrorType,
  addressToHex,
} from '../../utils/address/addressToHex.js'
import { bareHex } from '../../utils/encoding/bareHex.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../utils/transaction/registry.js'
import type { RawContract } from '../../utils/transaction/serializeRawData.js'
import {
  type AccountPermissionUpdateContract,
  type BytesInput,
  type Int64,
  type Permission,
  type PermissionKey,
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

/**
 * A permission granted to a set of signer keys — the input shape for the
 * `owner` and `witness` slots. The permission `type` is forced from the slot
 * the value is passed in, and ids are chain-assigned (owner = 0, witness = 1),
 * so neither can be supplied.
 */
export type PermissionInput = {
  /** Permission name (informational, e.g. `'owner'`). */
  permission_name?: string | undefined
  /** Combined signature weight required to authorize an operation (`int64`). */
  threshold: Int64
  /** Signer keys and their weights (`{ address, weight }`) — at least one. */
  keys: PermissionKey[]
}

/**
 * An active permission — a {@link PermissionInput} that additionally carries
 * the mandatory `operations` bitmap: 32 bytes whose bit `n` (little-endian
 * within each byte) allows contract type `n`.
 */
export type ActivePermissionInput = PermissionInput & {
  /**
   * Permission id. Active permission ids are assigned BY POSITION: the chain
   * stores `actives[i]` as id `i + 2` (owner is 0, witness 1) unconditionally.
   * Omit it and the chain assigns it; if supplied it must equal the slot's
   * `i + 2`, else the update is refused — a mismatched id would be signed but
   * never stored, and reordered ids (`[{ id: 3 }, { id: 2 }]`) would bind each
   * key set to the opposite id from what was written.
   */
  id?: number | undefined
  /** Allowed contract types, as a 32-byte bitmap (hex or raw bytes). */
  operations: BytesInput
}

export type AccountPermissionUpdateParameters = {
  /** The account whose permissions are being updated (falls back to `client.account`). */
  account?: TronAccount | AccountKey | undefined
  /**
   * The new owner permission. Required: the update replaces the account's
   * whole permission set, so java-tron rejects a contract without it.
   */
  owner: PermissionInput
  /** The new witness/SR permission (only meaningful for SR accounts). */
  witness?: PermissionInput | undefined
  /** The new active permissions. Required: at least one must be supplied. */
  actives: ActivePermissionInput[]
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
  | BaseErrorType
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
  | BaseErrorType
  | BuildTransactionErrorType
  | ParseAccountErrorType
  | AddressToHexErrorType
  | ErrorType

/**
 * Validates a permission input and assembles the codec model for its slot.
 * Fields are picked explicitly: stray model fields on the caller's object
 * (`type`, `parent_id`, or `operations` on an owner/witness permission, which
 * java-tron forbids) must not ride into the signed bytes.
 */
function toPermission(
  input: PermissionInput,
  slot: string,
  type: PermissionType,
): Permission {
  if (input.threshold === undefined || input.threshold === null)
    throw new BaseError(`Invalid ${slot} permission: missing \`threshold\`.`)
  if (!Array.isArray(input.keys) || input.keys.length === 0)
    throw new BaseError(
      `Invalid ${slot} permission: \`keys\` must carry at least one signer.`,
    )
  return {
    type,
    ...(input.permission_name !== undefined
      ? { permission_name: input.permission_name }
      : {}),
    threshold: input.threshold,
    // Pinned to hex here, synchronously: the codec first reads the model after
    // the block fetch, so a caller-owned `Uint8Array` carried by reference
    // could change between this check and the bytes that get signed.
    keys: input.keys.map(({ address, weight }) => ({
      address: addressToHex(address),
      weight,
    })),
  }
}

/** {@link toPermission} plus the active-only `id` and 32-byte `operations`. */
function toActivePermission(
  input: ActivePermissionInput,
  slot: string,
  index: number,
): Permission {
  const permission = toPermission(input, slot, PermissionType.ACTIVE)
  const { id, operations } = input
  // The chain stores actives by position: `AccountCapsule.updatePermissions`
  // rewrites `actives[i].id = i + 2` unconditionally and the actuator never
  // checks the supplied id, so a provided id that differs from its slot would
  // be signed but never stored — and `[{ id: 3 }, { id: 2 }]` would bind the
  // first key set to id 2 and the second to id 3, the reverse of what the ids
  // say. Refuse the mismatch; an omitted id is fine (the chain assigns i + 2).
  const expectedId = index + 2
  if (id !== undefined && id !== expectedId)
    throw new BaseError(
      `Invalid ${slot} permission: \`id\` must be ${expectedId} (active permission ids are assigned by position — the chain stores actives[${index}] as id ${expectedId}). Got ${id}.`,
    )
  if (operations === undefined || operations === null)
    throw new BaseError(
      `Invalid ${slot} permission: missing \`operations\` (the 32-byte bitmap of allowed contract types).`,
    )
  // java-tron rejects any other size; whole-byte hex only, since the codec
  // refuses odd-nibble strings anyway.
  const is32Bytes =
    operations instanceof Uint8Array
      ? operations.length === 32
      : typeof operations === 'string' &&
        /^(?:0x)?[0-9a-fA-F]{64}$/.test(operations)
  if (!is32Bytes)
    throw new BaseError(
      `Invalid ${slot} permission: \`operations\` must be a 32-byte bitmap (64 hex chars or a 32-byte Uint8Array).`,
    )
  return {
    ...permission,
    ...(id !== undefined ? { id } : {}),
    // Snapshot of the bytes that passed the guard above (see `keys`).
    operations: bareHex(operations),
  }
}

/** The signing account plus the assembled `AccountPermissionUpdateContract` and `fee_limit`. */
function assemble(
  client: Client,
  parameters: AccountPermissionUpdateParameters,
): { account: TronAccount; contract: RawContract } {
  const { owner, witness, actives } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  // The contract replaces the account's WHOLE permission set — a missing slot
  // is not "keep the current one". java-tron requires the full owner
  // permission and at least one active permission on every update, so refuse
  // locally (TypeScript already does; these guards catch plain-JS callers and
  // empty arrays) with an error that names the parameter, before the codec's
  // opaque required-field guard or the node does.
  if (!owner)
    throw new BaseError(
      'Missing owner permission: an account permission update replaces the whole permission set, so `owner` is required.',
    )
  if (!actives?.length)
    throw new BaseError(
      'Missing active permissions: an account permission update replaces the whole permission set, so `actives` must carry at least one permission.',
    )

  // Each permission's `type` is forced from the slot it was passed in.
  const value: AccountPermissionUpdateContract = {
    owner_address: addressToHex(account.address),
    owner: toPermission(owner, 'owner', PermissionType.OWNER),
    ...(witness
      ? { witness: toPermission(witness, 'witness', PermissionType.WITNESS) }
      : {}),
    actives: actives.map((active, i) =>
      toActivePermission(active, `actives[${i}]`, i),
    ),
  }

  const contract: RawContract = {
    type: ContractType.AccountPermissionUpdateContract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}AccountPermissionUpdateContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `AccountPermissionUpdateContract` transaction
 * (§ type 46) and returns it in java-tron's HTTP JSON shape
 * (`{ visible, txID, raw_data, raw_data_hex }`) — the build half of
 * {@link accountPermissionUpdate}, without signing or broadcasting. Pass
 * `permissionId` to bind it to an active/owner permission. The node is used only
 * to fetch the latest block (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters The new permission set, optional account/permissionId/blockHeader.
 * @returns An unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildAccountPermissionUpdate(
  client: Client,
  parameters: BuildAccountPermissionUpdateParameters,
): Promise<BuildAccountPermissionUpdateReturnType> {
  const { contract } = assemble(client, parameters)
  return buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
    expirationMs: parameters.expirationMs,
    memo: parameters.memo,
  })
}

/**
 * Updates an account's owner / witness / active permissions by locally
 * building, signing and broadcasting an `AccountPermissionUpdateContract`
 * (§ type 46) — the multi-sig setup step. The contract replaces the account's
 * whole permission set, so `owner` and at least one active permission are
 * required. Each permission's `type` is set from the slot it is passed in
 * (`owner` → OWNER, `witness` → WITNESS, `actives` → ACTIVE), so callers only
 * supply `threshold`, `keys` (`{ address, weight }`), an optional
 * `permission_name`, and — for active permissions — the 32-byte `operations`
 * bitmap of allowed contract types.
 *
 * @param client The Client to use.
 * @param parameters The new permission set, optional account/blockHeader.
 * @returns `{ txID, result, code, message }` — the locally computed
 * transaction id plus the node's acknowledgement fields, when echoed.
 */
export async function accountPermissionUpdate(
  client: Client,
  parameters: AccountPermissionUpdateParameters,
): Promise<AccountPermissionUpdateReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
    expirationMs: parameters.expirationMs,
    memo: parameters.memo,
  })
}
