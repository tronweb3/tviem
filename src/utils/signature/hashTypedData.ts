// Implements the EIP-712 / TIP-712 structured-data hash from the standard, over
// tviem's own keccak256 / encoding / address primitives — the only TRON-specific
// point is that `address`-typed values are converted from a TRON address form
// to their 20-byte EVM form before being left-padded into a 32-byte word.
import type {
  TypedDataDomain as AbiTypedDataDomain,
  TypedData,
  TypedDataParameter,
} from 'abitype'
import {
  BytesSizeMismatchError,
  type BytesSizeMismatchErrorType,
} from '../../errors/abi.js'
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import {
  InvalidDomainError,
  type InvalidDomainErrorType,
  InvalidPrimaryTypeError,
  type InvalidPrimaryTypeErrorType,
  InvalidStructTypeError,
  type InvalidStructTypeErrorType,
} from '../../errors/typedData.js'
import type { ErrorType } from '../../errors/utils.js'
import type { AddressInput } from '../../types/address.js'
import type { Hex } from '../../types/misc.js'
import { toEvm } from '../address/toEvm.js'
import { concat } from '../data/concat.js'
import { isHex } from '../data/isHex.js'
import { pad } from '../data/pad.js'
import { size } from '../data/size.js'
import { stringToBytes } from '../encoding/toBytes.js'
import {
  bytesToHex,
  type NumberToHexErrorType,
  numberToHex,
} from '../encoding/toHex.js'
import { keccak256 } from '../hash/keccak256.js'
import { bytesRegex, integerRegex } from '../regex.js'

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
  /**
   * The signing domain. Without a `types.EIP712Domain` declaration its present
   * canonical fields form the `EIP712Domain` struct; with one, it may carry
   * exactly the declared fields (custom fields included).
   */
  domain?: (TypedDataDomain & Record<string, unknown>) | undefined
  /**
   * The struct type definitions. `EIP712Domain` may be declared to override
   * the canonical domain struct (custom fields, order, or types); when
   * omitted it is derived from the domain value's present canonical fields.
   */
  types: TypedData | TypedDataTypes
  /** The struct being signed (or `'EIP712Domain'` for a domain-only signature). */
  primaryType: string
  /** The struct value, keyed by field name. */
  message?: Record<string, unknown> | undefined
}

export type HashTypedDataErrorType =
  | BaseErrorType
  | BytesSizeMismatchErrorType
  | InvalidDomainErrorType
  | InvalidPrimaryTypeErrorType
  | InvalidStructTypeErrorType
  | NumberToHexErrorType
  | ErrorType

/** Canonical domain field order and their EIP-712 types. */
const DOMAIN_FIELDS: readonly { name: string; type: string }[] = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
  { name: 'salt', type: 'bytes32' },
]

/**
 * The effective `EIP712Domain` struct: the caller's `types.EIP712Domain`
 * declaration when present (declared fields, order, and types), else the
 * canonical fields the domain value carries.
 */
function effectiveDomainFields(
  domain: TypedDataDomain | undefined,
  types: TypedDataTypes | undefined,
): readonly TypedDataParameter[] {
  return (
    types?.EIP712Domain ??
    DOMAIN_FIELDS.filter(
      (f) => (domain as Record<string, unknown> | undefined)?.[f.name] != null,
    )
  )
}

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
  return keccak256(stringToBytes(encodeType(primaryType, types)))
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
  // A `string` value is always UTF-8 (matching EIP-712 / viem's `toHex`): a
  // hex-detecting encoder would hash the 4 bytes of `"0xdeadbeef"` instead of
  // its 10 characters, so a signature could not be cross-verified with any
  // standard implementation.
  if (type === 'string') return keccak256(stringToBytes(value as string))
  if (type === 'bool') return pad(value ? '0x01' : '0x00')
  if (type === 'address') return pad(toEvm(value as AddressInput), { size: 32 })
  // Validation accepts a `Uint8Array` for `bytesN`, but the surrounding words
  // are hex and `pad` mirrors its input's kind — so convert to hex first.
  if (type.startsWith('bytes'))
    return pad(
      value instanceof Uint8Array ? bytesToHex(value) : (value as Hex),
      {
        dir: 'right',
        size: 32,
      },
    )
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

/**
 * A struct name that also reads as a primitive type would win the struct
 * branch of `encodeField`, silently hijacking every field of that type —
 * the TRON-specific `trcToken` included.
 */
function assertStructNotShadowing(type: string): void {
  if (
    type === 'address' ||
    type === 'bool' ||
    type === 'string' ||
    type === 'trcToken' ||
    bytesRegex.test(type) ||
    integerRegex.test(type)
  )
    throw new InvalidStructTypeError({ type })
}

/** Human name of a value's kind, for validation error messages. */
function kindOf(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  return typeof value
}

/** Validates every field of a struct value against its declared types. */
function validateStruct(
  types: TypedDataTypes,
  type: string,
  data: Record<string, unknown>,
): void {
  for (const field of types[type] ?? []) {
    // EIP-712 has no optional fields: every declared field must be present. A
    // missing `string` field would otherwise hash as "" (TextEncoder coerces
    // undefined to the empty string) — a plausible digest for a value the
    // caller never wrote.
    if (data?.[field.name] === undefined)
      throw new BaseError(
        `Missing ${type}.${field.name} value (declared as "${field.type}").`,
      )
    validateField(types, field.type, data[field.name])
  }
}

/** Validates one value against its declared field type (recursing into
 * structs and arrays). Mirrors `encodeField`'s dispatch order. */
function validateField(
  types: TypedDataTypes,
  type: string,
  value: unknown,
): void {
  if (types[type]) {
    assertStructNotShadowing(type)
    // A non-object struct value would slip through the per-field checks (its
    // fields all read as `undefined`) and only surface as a raw TypeError —
    // or a wrong digest — deep inside encoding.
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      throw new BaseError(
        `Invalid ${type} value: expected an object, got ${kindOf(value)}.`,
      )
    validateStruct(types, type, value as Record<string, unknown>)
    return
  }

  if (type.endsWith(']')) {
    const base = type.replace(/\[\d*\]$/, '')
    // A fixed-size `T[N]` must have exactly `N` elements: `encodeField` hashes
    // the concatenated element words, so a short/long array silently produces a
    // digest for a different value than the declared type. (`$` anchors the
    // outer dimension, so multi-dimensional arrays check each level in turn.)
    const fixed = type.match(/\[(\d+)\]$/)
    if (fixed && (!Array.isArray(value) || value.length !== Number(fixed[1])))
      throw new BaseError(
        `Invalid ${type} value: expected an array of length ${fixed[1]}, got ${
          Array.isArray(value) ? value.length : typeof value
        }.`,
      )
    // A dynamic `T[]` must still be an array — anything else would escape as a
    // raw `.map is not a function` TypeError in `encodeField`.
    if (!Array.isArray(value))
      throw new BaseError(
        `Invalid ${type} value: expected an array, got ${kindOf(value)}.`,
      )
    for (const item of value) validateField(types, base, item)
    return
  }

  // `bool`: a real boolean only. `encodeField` encodes by truthiness, so a
  // stringly-typed value would sign the OPPOSITE of what it spells — `"false"`
  // is truthy and would encode as `true` (a revoked approval as an approval).
  if (type === 'bool') {
    if (typeof value !== 'boolean')
      throw new BaseError(
        `Invalid bool value: expected a boolean, got ${
          typeof value === 'string' ? `"${value}"` : String(value)
        }.`,
      )
    return
  }

  // `(u)intN`: the value must fit the declared width. `encodeField` always
  // encodes a full 32-byte word, so narrower widths are only enforced here.
  const integerMatch = type.match(integerRegex)
  if (
    integerMatch &&
    (typeof value === 'number' ||
      typeof value === 'bigint' ||
      typeof value === 'string')
  ) {
    // A `number` past 2^53 has already been rounded by IEEE-754 before it got
    // here, so `BigInt()` would faithfully encode a value the caller never
    // wrote; a fraction/NaN would otherwise escape as a raw RangeError. Pass a
    // bigint (or decimal string) for values past 2^53.
    if (typeof value === 'number' && !Number.isSafeInteger(value))
      throw new BaseError(
        `Invalid ${type} value: ${value} is not a safe integer. Pass a bigint (or decimal string) for values past 2^53.`,
      )
    const [, base, bits] = integerMatch
    const big = (() => {
      try {
        return BigInt(value)
      } catch {
        return undefined // not numeric — encodeField reports the conversion
      }
    })()
    if (big !== undefined)
      numberToHex(big, {
        signed: base === 'int',
        size: (bits ? Number(bits) : 256) / 8,
      })
    return
  }

  const bytesMatch = type.match(bytesRegex)
  if (bytesMatch) {
    // A hex `bytes`/`bytesN` value must be 0x-prefixed whole bytes: an odd
    // nibble count gets a nibble invented by padding (and slips past the
    // size check below, which rounds UP), while an unprefixed string loses
    // its leading byte to `slice(2)` in hex decoding — either way the
    // digest is over bytes the caller never wrote.
    if (typeof value === 'string' && (!isHex(value) || value.length % 2 !== 0))
      throw new BaseError(
        `Invalid ${type} value: expected a 0x-prefixed even-length hex string, got "${value}".`,
      )
    // `bytesN`: must be exactly `N` bytes (`encodeField` would silently
    // right-pad a short value into a different digest).
    if (
      bytesMatch[1] &&
      (typeof value === 'string' || value instanceof Uint8Array)
    ) {
      const expectedSize = Number(bytesMatch[1])
      const givenSize = size(value as Hex)
      if (givenSize !== expectedSize)
        throw new BytesSizeMismatchError({ expectedSize, givenSize })
    }
  }
}

/**
 * Validates typed-data parameters before any hashing: `primaryType` must be
 * a defined struct (or `EIP712Domain`) and must not shadow a primitive type,
 * the domain must be an object whose fields all belong to the effective
 * `EIP712Domain` struct and match its types, integer values must fit their
 * declared width, and `bytesN` values must be exactly `N` bytes — so
 * malformed input fails loudly instead of producing a silently wrong digest.
 */
function validateTypedData(parameters: HashTypedDataParameters): void {
  const { domain, types, primaryType, message } = parameters
  const types_ = types as TypedDataTypes

  if (primaryType !== 'EIP712Domain' && !types_[primaryType])
    throw new InvalidPrimaryTypeError({ primaryType, types: types_ })

  if (domain !== undefined) {
    if (typeof domain !== 'object' || domain === null || Array.isArray(domain))
      throw new InvalidDomainError({ domain })
    // Every present domain field must have a slot in the `EIP712Domain`
    // struct — a field the struct does not carry would vanish from the hash
    // without a trace, so the caller would sign less than they wrote.
    const declared = new Set(
      effectiveDomainFields(domain, types_).map((f) => f.name),
    )
    for (const key of Object.keys(domain))
      if (
        (domain as Record<string, unknown>)[key] != null &&
        !declared.has(key)
      )
        throw new BaseError(
          `Unknown domain field "${key}": it has no slot in the EIP712Domain struct, so it would be silently dropped from the hash. Declare it in \`types.EIP712Domain\` or remove it.`,
        )
  }

  if (types_.EIP712Domain) {
    // A declared domain struct is validated like any other struct: every
    // declared field must be present and match its declared type.
    validateStruct(
      types_,
      'EIP712Domain',
      (domain ?? {}) as Record<string, unknown>,
    )
  } else if (domain !== undefined) {
    // The derived domain is encoded against the fixed `DOMAIN_FIELDS` types
    // (never against `types`), so its fields are validated as bare primitives.
    for (const field of DOMAIN_FIELDS) {
      const value = (domain as Record<string, unknown>)[field.name]
      if (value != null) validateField({}, field.type, value)
    }
  }

  if (primaryType !== 'EIP712Domain') {
    assertStructNotShadowing(primaryType)
    validateStruct(types_, primaryType, message ?? {})
  }
}

/**
 * Hashes the domain as an `EIP712Domain` struct. The struct is the caller's
 * `types.EIP712Domain` declaration when one is present in `types`, else the
 * canonical fields present on the domain value.
 */
export function hashDomain(
  domain: TypedDataDomain & Record<string, unknown>,
  types?: TypedDataTypes | undefined,
): Hex {
  // Spread `types` too, so a declared domain field may reference a struct.
  return hashStruct(
    'EIP712Domain',
    { ...types, EIP712Domain: effectiveDomainFields(domain, types) },
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
 * The domain struct is derived from the domain value's present canonical
 * fields, unless `types.EIP712Domain` declares it explicitly — the declaration
 * then wins (custom fields, order, and types). Either way, a domain field
 * without a slot in the struct throws rather than silently dropping out of
 * the hash.
 *
 * Parameters are validated before hashing (unknown `primaryType`, primitive-
 * shadowing struct names, malformed domain, out-of-width integers, wrong-size
 * `bytesN` values), so bad input throws instead of yielding a wrong digest.
 *
 * @param parameters `domain`, `types`, `primaryType`, `message`.
 * @returns The `0x`-prefixed 32-byte digest.
 */
export function hashTypedData(parameters: HashTypedDataParameters): Hex {
  validateTypedData(parameters)
  const { domain = {}, types, primaryType, message = {} } = parameters
  const parts: Hex[] = ['0x1901']
  parts.push(hashDomain(domain, types as TypedDataTypes))
  if (primaryType !== 'EIP712Domain')
    parts.push(hashStruct(primaryType, types as TypedDataTypes, message))
  return keccak256(concat(parts))
}
