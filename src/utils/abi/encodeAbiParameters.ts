import type {
  AbiParameter,
  AbiParameterKind,
  SolidityFixedArrayRange,
} from 'abitype'

import {
  AbiEncodingArrayLengthMismatchError,
  type AbiEncodingArrayLengthMismatchErrorType,
  AbiEncodingBytesSizeMismatchError,
  type AbiEncodingBytesSizeMismatchErrorType,
  AbiEncodingLengthMismatchError,
  type AbiEncodingLengthMismatchErrorType,
  InvalidAbiEncodingTypeError,
  type InvalidAbiEncodingTypeErrorType,
  InvalidAbiParameterValueError,
  type InvalidAbiParameterValueErrorType,
  InvalidArrayError,
  type InvalidArrayErrorType,
} from '../../errors/abi.js'
import {
  IntegerOutOfRangeError,
  type IntegerOutOfRangeErrorType,
} from '../../errors/encoding.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Address, AddressInput } from '../../types/address.js'
import type { Hex } from '../../types/misc.js'
import type { Prettify } from '../../types/utils.js'
import { type ToEvmErrorType, toEvm } from '../address/toEvm.js'
import { type ConcatHexErrorType, concatHex } from '../data/concat.js'
import {
  type AssertHexBytesErrorType,
  assertHexBytes,
  isHex,
} from '../data/isHex.js'
import { type PadHexErrorType, padHex } from '../data/pad.js'
import { type SizeErrorType, size } from '../data/size.js'
import {
  type BoolToHexErrorType,
  boolToHex,
  type NumberToHexErrorType,
  numberToHex,
  type StringToHexErrorType,
  stringToHex,
} from '../encoding/toHex.js'
import { arrayRegex, bytesRegex, integerRegex } from '../regex.js'

/**
 * Primitive TypeScript type for a single ABI parameter, TRON flavor:
 * - `address` is wide-in (`T…` Base58Check, `41…` TRON hex, or `0x…` EVM
 *   hex) and brand-out (`T…` Base58Check).
 * - `trcToken` behaves exactly like `uint256` (bigint).
 * - all integer widths decode to bigint; encoding also accepts number.
 * - tuples map to objects when every component is named, otherwise to
 *   positional tuples.
 */
export type TronAbiParameterToPrimitiveType<
  param extends { type: string },
  kind extends AbiParameterKind = AbiParameterKind,
> = param['type'] extends `${infer itemType}[${
  | ''
  | `${SolidityFixedArrayRange}`}]`
  ? readonly TronAbiParameterToPrimitiveType<
      Omit<param, 'type'> & { type: itemType },
      kind
    >[]
  : param['type'] extends 'tuple'
    ? param extends {
        components: infer components extends readonly { type: string }[]
      }
      ? _HasUnnamedComponent<components> extends true
        ? {
            -readonly [key in keyof components]: components[key] extends {
              type: string
            }
              ? TronAbiParameterToPrimitiveType<components[key], kind>
              : unknown
          }
        : Prettify<{
            [component in components[number] as component extends {
              name: infer name extends string
            }
              ? name
              : never]: TronAbiParameterToPrimitiveType<component, kind>
          }>
      : unknown
    : param['type'] extends 'address'
      ? kind extends 'outputs'
        ? Address
        : AddressInput
      : param['type'] extends 'bool'
        ? boolean
        : param['type'] extends 'string'
          ? string
          : param['type'] extends `bytes${string}`
            ? Hex
            : param['type'] extends
                  | 'trcToken'
                  | `int${string}`
                  | `uint${string}`
              ? kind extends 'outputs'
                ? bigint
                : bigint | number
              : unknown

type _HasUnnamedComponent<components extends readonly { type: string }[]> =
  components extends readonly [
    infer head extends { type: string },
    ...infer tail extends readonly { type: string }[],
  ]
    ? head extends { name: infer name extends string }
      ? name extends ''
        ? true
        : _HasUnnamedComponent<tail>
      : true
    : false

/** Positional primitive types for a list of ABI parameters (TRON flavor). */
export type TronAbiParametersToPrimitiveTypes<
  params extends readonly { type: string }[],
  kind extends AbiParameterKind = AbiParameterKind,
> = {
  [key in keyof params]: params[key] extends { type: string }
    ? TronAbiParameterToPrimitiveType<params[key], kind>
    : unknown
}

export type EncodeAbiParametersReturnType = Hex

export type EncodeAbiParametersErrorType =
  | AbiEncodingArrayLengthMismatchErrorType
  | AssertHexBytesErrorType
  | AbiEncodingBytesSizeMismatchErrorType
  | AbiEncodingLengthMismatchErrorType
  | ToEvmErrorType
  | BoolToHexErrorType
  | ConcatHexErrorType
  | IntegerOutOfRangeErrorType
  | InvalidAbiEncodingTypeErrorType
  | InvalidAbiParameterValueErrorType
  | InvalidArrayErrorType
  | NumberToHexErrorType
  | PadHexErrorType
  | SizeErrorType
  | StringToHexErrorType
  | ErrorType

/**
 * Encodes a list of primitive values into ABI-encoded data, per the Solidity
 * ABI specification: every static parameter occupies one 32-byte slot in the
 * head; every dynamic parameter (`bytes`, `string`, dynamic arrays, and
 * composites containing them) puts a byte offset in the head and its payload
 * in the tail; arrays and tuples recurse.
 *
 * TRON behavior: `address` accepts any TRON form (`T…` Base58Check, `41…`
 * TRON hex, `0x…` EVM hex) and encodes its 20-byte body left-padded to
 * 32 bytes; `trcToken` encodes exactly like `uint256`.
 *
 * @example
 * encodeAbiParameters(
 *   [{ type: 'address' }, { type: 'uint256' }],
 *   ['T...', 1000000n],
 * )
 * // '0x...' — the 20-byte address body left-padded to 32 bytes, then the uint256
 */
export function encodeAbiParameters<
  const params extends readonly AbiParameter[] | readonly unknown[],
>(
  params: params,
  values: params extends readonly AbiParameter[]
    ? TronAbiParametersToPrimitiveTypes<params, 'inputs'>
    : readonly unknown[],
): EncodeAbiParametersReturnType {
  if (params.length !== (values as readonly unknown[]).length)
    throw new AbiEncodingLengthMismatchError({
      expectedLength: params.length,
      givenLength: (values as readonly unknown[]).length,
    })
  const preparedParams = prepareParams({
    params: params as readonly AbiParameter[],
    values: values as readonly unknown[],
  })
  return encodeParams(preparedParams)
}

/**
 * Splits an ABI type into its outermost array suffix and inner type:
 * `'uint256[3][2]'` → `[2, 'uint256[3]']`, `'string[]'` → `[null, 'string']`
 * (`null` length = dynamic-size). Returns `undefined` for non-array types.
 */
export function getArrayComponents(
  type: string,
): [length: number | null, innerType: string] | undefined {
  const matches = type.match(arrayRegex)
  if (!matches) return undefined
  return [matches[2] === '' ? null : Number(matches[2]), matches[1]!]
}

/**
 * Whether an ABI type is dynamic per the Solidity ABI specification: `bytes`,
 * `string`, `T[]` for any `T`, `T[k]` for any dynamic `T` and any `k >= 0`,
 * and a tuple with any dynamic component.
 *
 * This is driven by the TYPE alone — never by a value — because both ends must
 * reach the same answer for the same parameter, and a `T[0]` has no elements
 * to inspect.
 */
export function isDynamicType(param: AbiParameter): boolean {
  const { type } = param
  if (type === 'string' || type === 'bytes') return true
  const arrayComponents = getArrayComponents(type)
  if (arrayComponents) {
    const [length, innerType] = arrayComponents
    if (length === null) return true
    return isDynamicType({ ...param, type: innerType } as AbiParameter)
  }
  if (type === 'tuple')
    return ((param as TupleAbiParameter).components ?? []).some(isDynamicType)
  return false
}

/////////////////////////////////////////////////////////////////////////////
// Internal

type PreparedParam = { dynamic: boolean; encoded: Hex }

type TupleAbiParameter = AbiParameter & { components: readonly AbiParameter[] }

function prepareParams({
  params,
  values,
}: {
  params: readonly AbiParameter[]
  values: readonly unknown[]
}): PreparedParam[] {
  const preparedParams: PreparedParam[] = []
  for (let i = 0; i < params.length; i++)
    preparedParams.push(prepareParam({ param: params[i]!, value: values[i] }))
  return preparedParams
}

function prepareParam({
  param,
  value,
}: {
  param: AbiParameter
  value: unknown
}): PreparedParam {
  // Mirrors `decodeParameter`: a malformed descriptor is a typed error, not a
  // raw TypeError from reading `.type` off null/undefined.
  const type = (param as { type?: unknown } | null | undefined)?.type
  if (typeof type !== 'string')
    throw new InvalidAbiEncodingTypeError(String(type), {
      docsPath: '/docs/abi/encodeAbiParameters',
    })
  const arrayComponents = getArrayComponents(param.type)
  if (arrayComponents) {
    const [length, type] = arrayComponents
    return encodeArray(value, { length, param: { ...param, type } })
  }
  if (param.type === 'tuple')
    return encodeTuple(value, { param: param as TupleAbiParameter })
  if (param.type === 'address') return encodeAddress(value)
  if (param.type === 'bool') return encodeBool(value)
  // `trcToken` encodes exactly like `uint256`.
  if (param.type === 'trcToken')
    return encodeNumber(value, { bits: 256, signed: false, type: param.type })
  const integerMatch = param.type.match(integerRegex)
  if (integerMatch) {
    const [, baseType, bits] = integerMatch
    return encodeNumber(value, {
      bits: bits ? Number(bits) : 256,
      signed: baseType === 'int',
      type: param.type,
    })
  }
  const bytesMatch = param.type.match(bytesRegex)
  if (bytesMatch)
    return encodeBytes(value, {
      size: bytesMatch[1] ? Number(bytesMatch[1]) : null,
      type: param.type,
    })
  if (param.type === 'string') return encodeString(value)
  throw new InvalidAbiEncodingTypeError(param.type, {
    docsPath: '/docs/abi/encodeAbiParameters',
  })
}

/**
 * Assembles prepared parameters into head + tail form: static parameters are
 * inlined into the head; each dynamic parameter contributes a 32-byte offset
 * slot to the head and appends its payload to the tail. Offsets are relative
 * to the start of the assembled block.
 */
function encodeParams(preparedParams: readonly PreparedParam[]): Hex {
  let staticSize = 0
  for (const { dynamic, encoded } of preparedParams)
    staticSize += dynamic ? 32 : size(encoded)

  const heads: Hex[] = []
  const tails: Hex[] = []
  let dynamicSize = 0
  for (const { dynamic, encoded } of preparedParams) {
    if (dynamic) {
      heads.push(numberToHex(staticSize + dynamicSize, { size: 32 }))
      tails.push(encoded)
      dynamicSize += size(encoded)
    } else heads.push(encoded)
  }
  return concatHex([...heads, ...tails])
}

function encodeAddress(value: unknown): PreparedParam {
  if (typeof value !== 'string' && !(value instanceof Uint8Array))
    throw new InvalidAbiParameterValueError({ type: 'address', value })
  return {
    dynamic: false,
    encoded: padHex(toEvm(value as AddressInput), { size: 32 }),
  }
}

function encodeArray(
  value: unknown,
  { length, param }: { length: number | null; param: AbiParameter },
): PreparedParam {
  const dynamic = length === null
  if (!Array.isArray(value)) throw new InvalidArrayError(value)
  if (!dynamic && value.length !== length)
    throw new AbiEncodingArrayLengthMismatchError({
      expectedLength: length,
      givenLength: value.length,
      type: `${param.type}[${length}]`,
    })

  // Driven by the element TYPE, not by the prepared elements: a `T[0]` has no
  // elements to inspect, so a value-driven answer called `string[0]` static
  // and emitted no head slot — while the type-driven decoder consumed one,
  // shifting every parameter after it.
  const dynamicChild = isDynamicType(param)
  const preparedParams: PreparedParam[] = []
  for (let i = 0; i < value.length; i++)
    preparedParams.push(prepareParam({ param, value: value[i] }))

  if (dynamic || dynamicChild) {
    const data = encodeParams(preparedParams)
    if (dynamic) {
      const lengthWord = numberToHex(preparedParams.length, { size: 32 })
      return {
        dynamic: true,
        encoded:
          preparedParams.length > 0
            ? concatHex([lengthWord, data])
            : lengthWord,
      }
    }
    return { dynamic: true, encoded: data }
  }
  return {
    dynamic: false,
    encoded: concatHex(preparedParams.map(({ encoded }) => encoded)),
  }
}

function encodeBool(value: unknown): PreparedParam {
  if (typeof value !== 'boolean')
    throw new InvalidAbiParameterValueError({ type: 'bool', value })
  return { dynamic: false, encoded: boolToHex(value, { size: 32 }) }
}

function encodeBytes(
  value: unknown,
  { size: paramSize, type }: { size: number | null; type: string },
): PreparedParam {
  if (!isHex(value)) throw new InvalidAbiParameterValueError({ type, value })
  // Before any width check: `size` rounds an odd nibble count up, so the
  // check below would pass and `padHex` would invent the missing nibble.
  assertHexBytes(value)
  const bytesSize = size(value)
  if (paramSize === null) return encodeDynamicBytes(value)
  if (bytesSize !== paramSize)
    throw new AbiEncodingBytesSizeMismatchError({
      expectedSize: paramSize,
      value,
    })
  return { dynamic: false, encoded: padHex(value, { dir: 'right', size: 32 }) }
}

/** Length-prefixed, right-padded (to a 32-byte multiple) dynamic payload. */
function encodeDynamicBytes(data: Hex): PreparedParam {
  const bytesSize = size(data)
  const padded =
    bytesSize % 32 === 0
      ? data
      : padHex(data, { dir: 'right', size: Math.ceil(bytesSize / 32) * 32 })
  return {
    dynamic: true,
    encoded: concatHex([numberToHex(bytesSize, { size: 32 }), padded]),
  }
}

function encodeNumber(
  value: unknown,
  { bits, signed, type }: { bits: number; signed: boolean; type: string },
): PreparedParam {
  if (typeof value !== 'number' && typeof value !== 'bigint')
    throw new InvalidAbiParameterValueError({ type, value })
  const value_ = BigInt(value)
  const max = signed
    ? (1n << (BigInt(bits) - 1n)) - 1n
    : (1n << BigInt(bits)) - 1n
  const min = signed ? -(1n << (BigInt(bits) - 1n)) : 0n
  if (value_ > max || value_ < min)
    throw new IntegerOutOfRangeError({
      max: max.toString(),
      min: min.toString(),
      signed,
      size: bits / 8,
      value: value_.toString(),
    })
  return {
    dynamic: false,
    encoded: numberToHex(value_, { signed, size: 32 }),
  }
}

function encodeString(value: unknown): PreparedParam {
  if (typeof value !== 'string')
    throw new InvalidAbiParameterValueError({ type: 'string', value })
  return encodeDynamicBytes(stringToHex(value))
}

function encodeTuple(
  value: unknown,
  { param }: { param: TupleAbiParameter },
): PreparedParam {
  if (typeof value !== 'object' || value === null)
    throw new InvalidAbiParameterValueError({ type: param.type, value })
  const components = param.components ?? []
  // Arity is strict, like the top level and fixed-size arrays: the loop below
  // reads one value per declared component, so anything extra is never looked
  // at. A struct that gained or lost a field between ABI versions would
  // otherwise encode to a well-formed but wrong payload. Reporting it here
  // also names the arity, which the undefined-value error a short tuple used
  // to raise did not.
  const givenLength = Array.isArray(value)
    ? value.length
    : Object.keys(value).length
  if (givenLength !== components.length)
    throw new AbiEncodingLengthMismatchError({
      expectedLength: components.length,
      givenLength,
    })
  let dynamic = false
  const preparedParams: PreparedParam[] = []
  for (let i = 0; i < components.length; i++) {
    const component = components[i]!
    const index = Array.isArray(value) ? i : component.name
    if (index === undefined)
      throw new InvalidAbiParameterValueError({ type: param.type, value })
    const preparedParam = prepareParam({
      param: component,
      value: (value as Record<string | number, unknown>)[index],
    })
    if (preparedParam.dynamic) dynamic = true
    preparedParams.push(preparedParam)
  }
  return {
    dynamic,
    encoded: dynamic
      ? encodeParams(preparedParams)
      : concatHex(preparedParams.map(({ encoded }) => encoded)),
  }
}
