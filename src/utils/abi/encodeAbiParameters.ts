// TRON-specific, clean-room implementation for @tronweb3/omni.
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
import { type AddressToHexErrorType, addressToHex } from '../address/toEvm.js'
import { type ConcatHexErrorType, concatHex } from '../data/concat.js'
import { isHex } from '../data/isHex.js'
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
  | AbiEncodingBytesSizeMismatchErrorType
  | AbiEncodingLengthMismatchErrorType
  | AddressToHexErrorType
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
 *   ['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 1000000n],
 * )
 * // '0x000000000000000000000000a614f803b6fd780986a42c78ec9c7f77e6ded13c00000000000000000000000000000000000000000000000000000000000f4240'
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
    encoded: padHex(addressToHex(value as AddressInput), { size: 32 }),
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

  let dynamicChild = false
  const preparedParams: PreparedParam[] = []
  for (let i = 0; i < value.length; i++) {
    const preparedParam = prepareParam({ param, value: value[i] })
    if (preparedParam.dynamic) dynamicChild = true
    preparedParams.push(preparedParam)
  }

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
  let dynamic = false
  const preparedParams: PreparedParam[] = []
  const components = param.components ?? []
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
