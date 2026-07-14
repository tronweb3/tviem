// TRON-specific, clean-room implementation for @tronweb3/omni.
// Implements the EIP-712 / TIP-712 structured-data hash from the standard, over
// omni's own keccak256 / encoding / address primitives — the only TRON-specific
// point is that `address`-typed values are converted from a TRON address form
// to their 20-byte EVM form before being left-padded into a 32-byte word.
import type {
  TypedDataDomain as AbiTypedDataDomain,
  TypedData,
  TypedDataParameter,
} from 'abitype'
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { AddressInput } from '../../types/address.js'
import type { Hex } from '../../types/misc.js'
import { addressToHex } from '../address/toEvm.js'
import { concat } from '../data/concat.js'
import { pad } from '../data/pad.js'
import { toBytes } from '../encoding/toBytes.js'
import { numberToHex } from '../encoding/toHex.js'
import { keccak256 } from '../hash/keccak256.js'

/** A map of struct name → its ordered fields. */
export type TypedDataTypes = Record<string, readonly TypedDataParameter[]>

/**
 * The TIP-712 signing domain. Identical to the EIP-712 domain except
 * `verifyingContract` accepts any TRON address form (Base58Check `T…`,
 * TRON hex `41…`, or EVM hex `0x…`) — matching the rest of the SDK's wide-in
 * address handling. It is encoded to its 20-byte EVM form before hashing.
 */
export type TypedDataDomain = Omit<AbiTypedDataDomain, 'verifyingContract'> & {
  verifyingContract?: AddressInput | undefined
}

export type HashTypedDataParameters = {
  /** The signing domain (its present fields form the `EIP712Domain` struct). */
  domain?: TypedDataDomain | undefined
  /** The struct type definitions (excluding `EIP712Domain`). */
  types: TypedData | TypedDataTypes
  /** The struct being signed (or `'EIP712Domain'` for a domain-only signature). */
  primaryType: string
  /** The struct value, keyed by field name. */
  message?: Record<string, unknown> | undefined
}

export type HashTypedDataErrorType = BaseErrorType | ErrorType

/** Canonical domain field order and their EIP-712 types. */
const DOMAIN_FIELDS: readonly { name: string; type: string }[] = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
  { name: 'salt', type: 'bytes32' },
]

/** Collects every struct type transitively referenced by `primaryType`. */
function findDependencies(
  primaryType: string,
  types: TypedDataTypes,
  found: Set<string> = new Set(),
): Set<string> {
  if (found.has(primaryType) || !types[primaryType]) return found
  found.add(primaryType)
  for (const field of types[primaryType]) {
    const base = field.type.replace(/\[.*\]$/, '')
    if (types[base]) findDependencies(base, types, found)
  }
  return found
}

/** Builds the EIP-712 type string: `Primary(...)` then its deps, sorted. */
function encodeType(primaryType: string, types: TypedDataTypes): string {
  const deps = [...findDependencies(primaryType, types)]
    .filter((t) => t !== primaryType)
    .sort()
  return [primaryType, ...deps]
    .map(
      (type) =>
        `${type}(${(types[type] ?? [])
          .map((f) => `${f.type} ${f.name}`)
          .join(',')})`,
    )
    .join('')
}

/** `keccak256` of the encoded type string (the struct's type hash). */
function hashType(primaryType: string, types: TypedDataTypes): Hex {
  return keccak256(toBytes(encodeType(primaryType, types)))
}

/** Encodes one field value to its 32-byte EIP-712 word. */
function encodeField(types: TypedDataTypes, type: string, value: unknown): Hex {
  // Nested struct → hashStruct.
  if (types[type])
    return keccak256(encodeData(type, types, value as Record<string, unknown>))

  // Array → keccak256 of the concatenated element words.
  if (type.endsWith(']')) {
    const base = type.replace(/\[\d*\]$/, '')
    const items = (value as unknown[]).map((item) =>
      encodeField(types, base, item),
    )
    return keccak256(concat(items))
  }

  if (type === 'bytes') return keccak256(value as Hex)
  if (type === 'string') return keccak256(toBytes(value as string))
  if (type === 'bool') return pad(value ? '0x01' : '0x00')
  if (type === 'address')
    return pad(addressToHex(value as AddressInput), { size: 32 })
  if (type.startsWith('bytes'))
    return pad(value as Hex, { dir: 'right', size: 32 })
  if (type.startsWith('uint') || type.startsWith('int') || type === 'trcToken')
    return numberToHex(BigInt(value as string | number | bigint), {
      signed: type.startsWith('int'),
      size: 32,
    })

  throw new BaseError(`Unsupported TIP-712 field type: "${type}".`)
}

/** `typeHash ++ encoded(field)…` for a struct value. */
function encodeData(
  primaryType: string,
  types: TypedDataTypes,
  data: Record<string, unknown>,
): Hex {
  const words: Hex[] = [hashType(primaryType, types)]
  for (const field of types[primaryType] ?? [])
    words.push(encodeField(types, field.type, data[field.name]))
  return concat(words)
}

/** `keccak256(encodeData(...))` — the struct hash. */
function hashStruct(
  primaryType: string,
  types: TypedDataTypes,
  data: Record<string, unknown>,
): Hex {
  return keccak256(encodeData(primaryType, types, data))
}

/** Hashes the domain as an `EIP712Domain` struct over its present fields. */
export function hashDomain(domain: TypedDataDomain): Hex {
  const present = DOMAIN_FIELDS.filter(
    (f) => (domain as Record<string, unknown>)[f.name] != null,
  )
  return hashStruct(
    'EIP712Domain',
    { EIP712Domain: present },
    domain as Record<string, unknown>,
  )
}

/**
 * Computes the 32-byte TIP-712 (EIP-712) digest that gets signed:
 * `keccak256("\x19\x01" ++ hashStruct(domain) ++ hashStruct(message))`.
 *
 * Clean-room from the EIP-712 standard; the only TRON-specific behavior is that
 * `address`-typed values (message fields and `domain.verifyingContract`) accept
 * any TRON address form and are encoded as their 20-byte EVM form, left-padded
 * to 32 bytes. When `primaryType` is `EIP712Domain`, only the domain is hashed.
 *
 * @param parameters `domain`, `types`, `primaryType`, `message`.
 * @returns The `0x`-prefixed 32-byte digest.
 */
export function hashTypedData(parameters: HashTypedDataParameters): Hex {
  const { domain = {}, types, primaryType, message = {} } = parameters
  const parts: Hex[] = ['0x1901']
  parts.push(hashDomain(domain))
  if (primaryType !== 'EIP712Domain')
    parts.push(hashStruct(primaryType, types as TypedDataTypes, message))
  return keccak256(concat(parts))
}
