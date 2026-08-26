import { BaseError, type BaseErrorType } from '../../../errors/base.js'
import type { ErrorType } from '../../../errors/utils.js'
import type { ByteArray } from '../../../types/misc.js'
import { concatBytes } from '../../data/concat.js'
import { int64InputToBigInt } from '../int64.js'
import { normalizeAddress } from '../normalize.js'
import { writeUvarint } from '../protobuf/varint.js'
import {
  type FIntErrorType,
  fBytes,
  fInt,
  fMessage,
  tag,
  WireType,
} from '../protobuf/writer.js'
import type {
  ContractAddressInput,
  ProposalApproveContract,
  ProposalCreateContract,
  ProposalDeleteContract,
} from '../types.js'
import {
  type DecodeMessageErrorType,
  decodeMessage,
  type EncodeMessageErrorType,
  encodeMessage,
  type MessageSpec,
} from './codec.js'

/** `ProposalCreateContract.parameters` map-entry (`map<int64,int64>`) schema. */
const proposalParameterSpec: MessageSpec = [
  { no: 1, name: 'key', kind: 'i64' },
  { no: 2, name: 'value', kind: 'i64' },
]

/** `ProposalCreateContract` (type 16) field schema (decode path). */
const proposalCreateContractSpec: MessageSpec = [
  { no: 1, name: 'owner_address', kind: 'address', required: true },
  {
    no: 2,
    name: 'parameters',
    kind: 'repeated-message',
    spec: proposalParameterSpec,
  },
]

/**
 * Encodes a single `int64` field, force-emitting it even when it is the proto3
 * default (`0`). A proto `map<int64,int64>` entry always serializes BOTH its
 * `key` and `value` fields, unlike a normal message field — so the generic,
 * default-omitting `fInt` cannot be used for map entries.
 */
function fIntMapEntry(fieldNo: number, value: bigint): ByteArray {
  if (value === 0n)
    return concatBytes([tag(fieldNo, WireType.Varint), writeUvarint(0n)])
  return fInt(fieldNo, value)
}

export type EncodeProposalCreateContractErrorType =
  | FIntErrorType
  | EncodeMessageErrorType
  | BaseErrorType
  | ErrorType

/** Throws when `object` carries a defined key outside `allowed`. */
function assertOnlyKeys(
  object: Record<string, unknown>,
  allowed: readonly string[],
  what: string,
): void {
  for (const key of Object.keys(object))
    if (object[key] !== undefined && !allowed.includes(key))
      throw new BaseError(`Unknown ${what} field "${key}".`)
}

/**
 * Encodes a `ProposalCreateContract` (contract type 16) body.
 *
 * Strict like {@link encodeMessage}, which this hand-rolled codec cannot reuse
 * because of the map encoding: the sign path byte-verifies whatever this emits,
 * so an unknown field would let the JSON model claim something the signed bytes
 * do not carry. `parameters` must be an array; each `key`/`value` goes through
 * the same safe-integer/decimal parsing as every other `int64` input; and a
 * duplicate key is refused rather than silently collapsed to last-one-wins by
 * the map parser (which would make the model and the executed value diverge).
 */
export function encodeProposalCreateContract(
  message: ProposalCreateContract,
): ByteArray {
  assertOnlyKeys(
    message,
    ['owner_address', 'parameters'],
    'ProposalCreateContract',
  )
  // Hand-rolled, so the spec's `required` flag is re-established by hand.
  // (`parameters` is chain-required but stays optional: an empty map is
  // absent from the wire, and gold fixtures carry such cases.)
  if (message.owner_address === undefined || message.owner_address === null)
    throw new BaseError(
      'Missing required field "owner_address" (unset, or set to its proto3 default).',
    )
  const parts: ByteArray[] = [
    fBytes(1, normalizeAddress(message.owner_address as ContractAddressInput)),
  ]
  const parameters = message.parameters ?? []
  if (!Array.isArray(parameters))
    throw new BaseError('ProposalCreateContract.parameters must be an array.')

  const seen = new Set<bigint>()
  const entries = parameters.map((entry) => {
    assertOnlyKeys(entry, ['key', 'value'], 'proposal parameter')
    const key = int64InputToBigInt('proposal parameter key', entry.key)
    const value = int64InputToBigInt('proposal parameter value', entry.value)
    if (seen.has(key))
      throw new BaseError(`Duplicate proposal parameter key ${key}.`)
    seen.add(key)
    return { key, value }
  })
  // `parameters` is a `map<int64,int64>`: each entry force-emits key + value.
  // A protobuf map serializes its entries sorted by the STRINGIFIED key in
  // ascending order (`"10" < "2"`), not by numeric key or caller order — so
  // the entries are sorted here to keep raw_data_hex/txID canonical whatever
  // order the caller supplies.
  entries.sort((a, b) => {
    const ka = String(a.key)
    const kb = String(b.key)
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })
  for (const entry of entries) {
    const body = concatBytes([
      fIntMapEntry(1, entry.key),
      fIntMapEntry(2, entry.value),
    ])
    parts.push(fMessage(2, body, { emitDefault: true }))
  }
  return concatBytes(parts)
}

export type DecodeProposalCreateContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes a `ProposalCreateContract` body. */
export function decodeProposalCreateContract(
  bytes: ByteArray,
): ProposalCreateContract {
  return decodeMessage(
    proposalCreateContractSpec,
    bytes,
  ) as ProposalCreateContract
}

/** `ProposalApproveContract` (type 17) field schema. */
const proposalApproveContractSpec: MessageSpec = [
  { no: 1, name: 'owner_address', kind: 'address', required: true },
  { no: 2, name: 'proposal_id', kind: 'i64' },
  { no: 3, name: 'is_add_approval', kind: 'bool' },
]

export type EncodeProposalApproveContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes a `ProposalApproveContract` (contract type 17) body. */
export function encodeProposalApproveContract(
  message: ProposalApproveContract,
): ByteArray {
  return encodeMessage(proposalApproveContractSpec, message)
}

export type DecodeProposalApproveContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes a `ProposalApproveContract` body. */
export function decodeProposalApproveContract(
  bytes: ByteArray,
): ProposalApproveContract {
  return decodeMessage(
    proposalApproveContractSpec,
    bytes,
  ) as ProposalApproveContract
}

/** `ProposalDeleteContract` (type 18) field schema. */
const proposalDeleteContractSpec: MessageSpec = [
  { no: 1, name: 'owner_address', kind: 'address', required: true },
  { no: 2, name: 'proposal_id', kind: 'i64' },
]

export type EncodeProposalDeleteContractErrorType =
  | EncodeMessageErrorType
  | ErrorType

/** Encodes a `ProposalDeleteContract` (contract type 18) body. */
export function encodeProposalDeleteContract(
  message: ProposalDeleteContract,
): ByteArray {
  return encodeMessage(proposalDeleteContractSpec, message)
}

export type DecodeProposalDeleteContractErrorType =
  | DecodeMessageErrorType
  | ErrorType

/** Decodes a `ProposalDeleteContract` body. */
export function decodeProposalDeleteContract(
  bytes: ByteArray,
): ProposalDeleteContract {
  return decodeMessage(
    proposalDeleteContractSpec,
    bytes,
  ) as ProposalDeleteContract
}
