import type { ErrorType } from '../../../errors/utils.js'
import type { ByteArray } from '../../../types/misc.js'
import { concatBytes } from '../../data/concat.js'
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
  { no: 1, name: 'ownerAddress', kind: 'address' },
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
  | ErrorType

/** Encodes a `ProposalCreateContract` (contract type 16) body. */
export function encodeProposalCreateContract(
  message: ProposalCreateContract,
): ByteArray {
  const parts: ByteArray[] = [
    fBytes(1, normalizeAddress(message.ownerAddress as ContractAddressInput)),
  ]
  // `parameters` is a `map<int64,int64>`: each entry force-emits key + value.
  // A protobuf map serializes its entries sorted by the STRINGIFIED key in
  // ascending order (`"10" < "2"`), not by numeric key or caller order — so
  // the entries are sorted here to keep raw_data_hex/txID canonical whatever
  // order the caller supplies.
  const entries = [...(message.parameters ?? [])].sort((a, b) => {
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
  { no: 1, name: 'ownerAddress', kind: 'address' },
  { no: 2, name: 'proposalId', kind: 'i64' },
  { no: 3, name: 'isAddApproval', kind: 'bool' },
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
  { no: 1, name: 'ownerAddress', kind: 'address' },
  { no: 2, name: 'proposalId', kind: 'i64' },
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
