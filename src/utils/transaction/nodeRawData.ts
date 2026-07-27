// TRON-specific, clean-room implementation for @tronweb3/omni.
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { AddressInput } from '../../types/address.js'
import { toHex } from '../address/toHex.js'
import { type DecodeRawDataErrorType, decodeRawData } from './decodeRawData.js'
import type { RawData } from './serializeRawData.js'
import {
  type NodeRawData,
  type ToNodeRawDataErrorType,
  toNodeRawData,
} from './toNodeRawData.js'

/**
 * The public signing surface accepts a `raw_data` in EITHER dialect: the SDK's
 * typed model, or java-tron's HTTP JSON (what `wallet/createtransaction`,
 * TronWeb and every explorer hand around). These helpers tell the two apart,
 * verify a node-JSON `raw_data` against the authoritative `raw_data_hex`
 * bytes, and render outgoing bodies in the node dialect.
 */

/** A `raw_data` in either dialect. */
export type AnyRawData = RawData | NodeRawData

export type AssertMatchesNodeRawDataErrorType =
  | ToNodeRawDataErrorType
  | BaseErrorType
  | ErrorType

export type ResolveRawDataErrorType =
  | AssertMatchesNodeRawDataErrorType
  | DecodeRawDataErrorType
  | ErrorType

/**
 * Detects java-tron's node-JSON `raw_data` dialect (snake_case field names,
 * string contract `type`, `parameter.type_url`) as opposed to the SDK model
 * (camelCase, numeric contract `type`, `parameter.typeUrl`).
 */
export function isNodeRawData(rawData: AnyRawData): rawData is NodeRawData {
  const r = rawData as Record<string, unknown>
  if ('ref_block_bytes' in r || 'ref_block_hash' in r || 'fee_limit' in r)
    return true
  const first = Array.isArray(r.contract) ? r.contract[0] : undefined
  if (!first || typeof first !== 'object') return false
  const f = first as Record<string, unknown>
  if (typeof f.type === 'string') return true
  const parameter = f.parameter as Record<string, unknown> | undefined
  return parameter !== undefined && 'type_url' in parameter
}

const BASE58_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/
const BARE_HEX = /^(?:[0-9a-fA-F]{2})+$/

/**
 * Canonicalizes one node-JSON leaf for comparison: Base58Check addresses
 * (`visible: true` renderings) become `41…` hex, and int64s that java-tron
 * renders as JSON numbers compare equal to their decimal-string form.
 */
function leaf(value: unknown): unknown {
  if (typeof value === 'number' || typeof value === 'bigint')
    return String(value)
  if (typeof value === 'string') {
    if (BASE58_ADDRESS.test(value)) {
      try {
        return toHex(value as AddressInput)
      } catch {
        return value
      }
    }
    if (BARE_HEX.test(value)) return value.toLowerCase()
    return value
  }
  return value
}

/** Returns the path of the first difference between two JSON trees, if any. */
function firstDifference(
  a: unknown,
  b: unknown,
  path: string,
): string | undefined {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
      return path
    for (let i = 0; i < a.length; i++) {
      const diff = firstDifference(a[i], b[i], `${path}[${i}]`)
      if (diff) return diff
    }
    return undefined
  }
  if (
    a !== null &&
    b !== null &&
    typeof a === 'object' &&
    typeof b === 'object'
  ) {
    const ka = Object.keys(a as object).filter(
      (k) => (a as Record<string, unknown>)[k] !== undefined,
    )
    const kb = Object.keys(b as object).filter(
      (k) => (b as Record<string, unknown>)[k] !== undefined,
    )
    if (ka.length !== kb.length) return path
    ka.sort()
    kb.sort()
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return path
    for (const key of ka) {
      const diff = firstDifference(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        `${path}.${key}`,
      )
      if (diff) return diff
    }
    return undefined
  }
  return leaf(a) === leaf(b) ? undefined : path
}

/**
 * Asserts a supplied node-JSON `raw_data` describes exactly the decoded
 * `raw_data_hex` bytes (TronWeb `txCheck` parity, with the bytes as the
 * source of truth): the model's canonical node rendering must structurally
 * equal the supplied JSON. Key order is ignored; int64 number/string and
 * `visible: true` Base58 address renderings are tolerated. A mismatch throws
 * — the human-readable JSON must never disagree with what gets signed.
 */
export function assertMatchesNodeRawData(
  node: NodeRawData,
  model: RawData,
): void {
  let canonical: NodeRawData
  try {
    canonical = toNodeRawData(model)
  } catch (error) {
    throw new BaseError(
      'The transaction contains a contract type this SDK cannot render as node JSON, so the supplied `raw_data` cannot be cross-checked. Sign it as `{ txID, raw_data_hex }` (drop `raw_data`).',
      { cause: error as Error },
    )
  }
  const diff = firstDifference(canonical, node, 'raw_data')
  if (diff)
    throw new BaseError(
      `The supplied \`raw_data\` JSON does not describe the \`raw_data_hex\` bytes (first mismatch at \`${diff}\`). The bytes are what gets signed — refusing to sign a transaction whose human-readable form disagrees with them.`,
    )
}

/**
 * Resolves a signable transaction's `raw_data` to the SDK model, accepting
 * either dialect:
 * - an SDK model is used as-is;
 * - a node-JSON `raw_data` requires the accompanying `raw_data_hex` (chain-
 *   and TronWeb-built transactions always carry it): the bytes are decoded as
 *   the source of truth and the JSON is verified against them via
 *   {@link assertMatchesNodeRawData};
 * - with no `raw_data`, `raw_data_hex` is decoded when present.
 *
 * @returns The resolved model, or `undefined` when the transaction carries
 * neither representation.
 */
export function resolveRawData(transaction: {
  raw_data?: AnyRawData | undefined
  raw_data_hex?: string | undefined
}): RawData | undefined {
  const input = transaction.raw_data
  if (input && isNodeRawData(input)) {
    if (!transaction.raw_data_hex)
      throw new BaseError(
        'A node-JSON `raw_data` must be accompanied by its `raw_data_hex` — the exact bytes to sign. Chain- and TronWeb-built transactions always carry it.',
      )
    const model = decodeRawData(transaction.raw_data_hex)
    assertMatchesNodeRawData(input, model)
    return model
  }
  if (input) return input as RawData
  return transaction.raw_data_hex
    ? decodeRawData(transaction.raw_data_hex)
    : undefined
}

/**
 * Renders a transaction's `raw_data` in the node dialect for outgoing JSON
 * bodies (`getsignweight` / `getapprovedlist` — endpoints that rebuild the
 * transaction from snake_case `raw_data` JSON): a node-JSON input passes
 * through, an SDK model (or bare `raw_data_hex`) is rendered canonically.
 */
export function nodeRawDataOf(transaction: {
  raw_data?: AnyRawData | undefined
  raw_data_hex?: string | undefined
}): NodeRawData | undefined {
  const input = transaction.raw_data
  if (input && isNodeRawData(input)) return input
  if (input) return toNodeRawData(input as RawData)
  return transaction.raw_data_hex
    ? toNodeRawData(decodeRawData(transaction.raw_data_hex))
    : undefined
}
