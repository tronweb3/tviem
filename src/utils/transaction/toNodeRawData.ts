// TRON-specific, clean-room implementation for @tronweb3/omni.
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import { type BytesToHexErrorType, bytesToHex } from '../encoding/toHex.js'
import { type FlexErrorType, flex } from './normalize.js'
import { getContractCodecByTypeUrl } from './registry.js'
import type { RawContract, RawData } from './serializeRawData.js'
import type { FlexInput } from './types.js'

/**
 * A `Transaction.raw_data` in java-tron's HTTP JSON shape (`visible: false`):
 * snake_case proto field names, string contract `type`, `41…`-hex addresses.
 */
export type NodeRawData = Record<string, unknown>

export type ToNodeRawDataErrorType =
  | FlexErrorType
  | BytesToHexErrorType
  | BaseErrorType
  | ErrorType

/** JS `MAX_SAFE_INTEGER` as a bigint bound for int64 → JSON number. */
const maxSafe = 9007199254740991n

/** Encodes an `int64` for JSON: a number when safe, else a decimal string. */
function int64ToJson(value: bigint | number): number | string {
  const v = BigInt(value)
  return v >= -maxSafe && v <= maxSafe ? Number(v) : v.toString()
}

// Proto fields that are already camelCase (java-tron's ABI mirrors the Solidity
// JSON ABI), so they must NOT be snake-cased.
const SNAKE_EXCEPTIONS = new Set(['stateMutability'])

/** camelCase → snake_case (proto field-name convention), minus exceptions. */
function toSnakeCase(name: string): string {
  if (SNAKE_EXCEPTIONS.has(name)) return name
  return name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

// java-tron's JsonFormat renders enum fields as their NAME string, not the
// integer. These are the only enum fields in the v0.1 contract set, keyed by
// contract name → snake_case path (relative to `parameter.value`) → the
// value→name table. Arrays anywhere in a path are mapped element-wise.
const RESOURCE_CODE = ['BANDWIDTH', 'ENERGY', 'TRON_POWER'] as const
const PERMISSION_TYPE = ['Owner', 'Witness', 'Active'] as const
const ABI_ENTRY_TYPE = [
  'UnknownEntryType',
  'Constructor',
  'Function',
  'Fallback',
  'Event',
  'Error',
  'Receive',
] as const
const STATE_MUTABILITY = [
  'UnknownMutabilityType',
  'Pure',
  'View',
  'Nonpayable',
  'Payable',
] as const

const ENUM_FIELDS: Record<string, Record<string, readonly string[]>> = {
  FreezeBalanceContract: { resource: RESOURCE_CODE },
  UnfreezeBalanceContract: { resource: RESOURCE_CODE },
  FreezeBalanceV2Contract: { resource: RESOURCE_CODE },
  UnfreezeBalanceV2Contract: { resource: RESOURCE_CODE },
  DelegateResourceContract: { resource: RESOURCE_CODE },
  UnDelegateResourceContract: { resource: RESOURCE_CODE },
  AccountPermissionUpdateContract: {
    'owner.type': PERMISSION_TYPE,
    'witness.type': PERMISSION_TYPE,
    'actives.type': PERMISSION_TYPE,
  },
  CreateSmartContract: {
    'new_contract.abi.entrys.type': ABI_ENTRY_TYPE,
    'new_contract.abi.entrys.stateMutability': STATE_MUTABILITY,
  },
}

// "Flex" (dual-form) fields are stored in the model as their raw input (UTF-8
// text, `0x`-hex, or bytes) and only become bytes on the wire — so a BUILT model
// carries e.g. the raw token id "1002000", not its hex. java-tron renders such
// bytes fields as bare hex (visible:false), so they must be normalized exactly
// like the protobuf codec does. Keyed by contract name → model field names.
// (A model DECODED from bytes already stores these as `0x…` hex, which
// `valueToNode` handles; this pass makes the build path agree.)
const FLEX_FIELDS: Record<string, readonly string[]> = {
  TransferAssetContract: ['assetName'],
  ParticipateAssetIssueContract: ['assetName'],
  AssetIssueContract: ['name', 'abbr', 'description', 'url'],
  UpdateAssetContract: ['description', 'url'],
  AccountUpdateContract: ['accountName'],
  SetAccountIdContract: ['accountId'],
  WitnessCreateContract: ['url'],
  WitnessUpdateContract: ['updateUrl'],
  ExchangeCreateContract: ['firstTokenId', 'secondTokenId'],
  ExchangeInjectContract: ['tokenId'],
  ExchangeWithdrawContract: ['tokenId'],
  ExchangeTransactionContract: ['tokenId'],
}

/** Rewrites the integer enum at `segments` (recursing into arrays) to its name. */
function applyEnumPath(
  node: unknown,
  segments: readonly string[],
  names: readonly string[],
): void {
  if (node === null || node === undefined) return
  if (Array.isArray(node)) {
    for (const el of node) applyEnumPath(el, segments, names)
    return
  }
  if (typeof node !== 'object') return
  const obj = node as Record<string, unknown>
  const [head, ...rest] = segments
  if (head === undefined) return
  if (rest.length === 0) {
    if (typeof obj[head] === 'number')
      obj[head] = names[obj[head] as number] ?? obj[head]
    return
  }
  applyEnumPath(obj[head], rest, names)
}

/**
 * Recursively converts a decoded contract-message value to node-JSON. The
 * decoded model already stores addresses as `41…` hex and int64 as `bigint`;
 * this snake-cases keys, JSON-encodes int64, and strips the `0x` prefix from
 * `bytes` fields (which decode to `0x…`). Addresses (`41…`), strings, numbers
 * and booleans pass through unchanged.
 */
function valueToNode(value: unknown): unknown {
  if (typeof value === 'bigint') return int64ToJson(value)
  if (typeof value === 'string')
    return value.startsWith('0x') ? value.slice(2) : value
  if (Array.isArray(value)) return value.map(valueToNode)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value)) {
      if (key === '__unknown' || v === undefined || v === null) continue
      out[toSnakeCase(key)] = valueToNode(v)
    }
    return out
  }
  return value
}

/** Converts one contract entry to its node-JSON shape. */
function contractToNode(contract: RawContract): Record<string, unknown> {
  const { typeUrl, value } = contract.parameter
  if ('__unknown' in value)
    throw new BaseError(
      `Cannot build node JSON for an unknown contract type: "${typeUrl}".`,
    )
  const name = getContractCodecByTypeUrl(typeUrl)?.name
  if (!name)
    throw new BaseError(`Unregistered contract type URL: "${typeUrl}".`)

  const nodeValue = valueToNode(value)
  const enums = ENUM_FIELDS[name]
  if (enums)
    for (const [path, names] of Object.entries(enums))
      applyEnumPath(nodeValue, path.split('.'), names)

  // Hex-encode flex fields from the ORIGINAL model value (before valueToNode's
  // `0x` stripping could make the input ambiguous), matching the wire bytes.
  const flexFields = FLEX_FIELDS[name]
  if (flexFields && nodeValue !== null && typeof nodeValue === 'object') {
    const model = value as Record<string, unknown>
    const out = nodeValue as Record<string, unknown>
    for (const field of flexFields) {
      const raw = model[field]
      if (raw !== undefined && raw !== null)
        out[toSnakeCase(field)] = bytesToHex(flex(raw as FlexInput)).slice(2)
    }
  }

  const entry: Record<string, unknown> = {
    type: name,
    parameter: { type_url: typeUrl, value: nodeValue },
  }
  // `Transaction.Contract.Permission_id` — note the non-standard capital `P`.
  if (contract.permissionId) entry.Permission_id = contract.permissionId
  return entry
}

/**
 * Converts a {@link RawData} model to java-tran's HTTP JSON shape, for the
 * endpoints that rebuild a transaction from `raw_data` JSON rather than from
 * `raw_data_hex` (`getsignweight` / `getapprovedlist`). Uses `visible: false`
 * conventions: `41…`-hex addresses, snake_case field names, string contract
 * `type`. A node re-serializing this JSON reproduces the same `raw_data` bytes,
 * so it recomputes the same `txID`.
 *
 * @param rawData The `raw_data` model.
 * @returns The node-JSON `raw_data`.
 */
export function toNodeRawData(rawData: RawData): NodeRawData {
  const out: Record<string, unknown> = {}
  if (rawData.refBlockBytes !== undefined)
    out.ref_block_bytes = rawData.refBlockBytes
  if (rawData.refBlockHash !== undefined)
    out.ref_block_hash = rawData.refBlockHash
  if (rawData.expiration !== undefined)
    out.expiration = int64ToJson(rawData.expiration)
  if (rawData.timestamp !== undefined)
    out.timestamp = int64ToJson(rawData.timestamp)
  if (rawData.feeLimit !== undefined && BigInt(rawData.feeLimit) !== 0n)
    out.fee_limit = int64ToJson(rawData.feeLimit)
  if (rawData.data) out.data = rawData.data
  out.contract = rawData.contract.map(contractToNode)
  return out
}
