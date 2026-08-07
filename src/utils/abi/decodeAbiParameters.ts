import type { AbiParameter } from 'abitype'

import {
  AbiDecodingDataSizeInvalidError,
  type AbiDecodingDataSizeInvalidErrorType,
  AbiDecodingDataSizeTooSmallError,
  type AbiDecodingDataSizeTooSmallErrorType,
  AbiDecodingZeroDataError,
  type AbiDecodingZeroDataErrorType,
  AbiDecodingZeroSizeElementError,
  type AbiDecodingZeroSizeElementErrorType,
  InvalidAbiDecodingTypeError,
  type InvalidAbiDecodingTypeErrorType,
} from '../../errors/abi.js'
import type { PositionOutOfBoundsErrorType } from '../../errors/cursor.js'
import {
  IntegerOutOfRangeError,
  type IntegerOutOfRangeErrorType,
  type InvalidBytesBooleanErrorType,
  InvalidHexValueError,
  type InvalidHexValueErrorType,
} from '../../errors/encoding.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Address } from '../../types/address.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import { type ToBase58ErrorType, toBase58 } from '../address/toBase58.js'
import {
  type CreateCursorErrorType,
  type Cursor,
  createCursor,
} from '../cursor.js'
import {
  bytesToBigInt,
  bytesToBool,
  bytesToNumber,
  bytesToString,
} from '../encoding/fromBytes.js'
import { hexToBytes } from '../encoding/toBytes.js'
import { bytesToHex } from '../encoding/toHex.js'
import { bytesRegex, integerRegex } from '../regex.js'
import {
  getArrayComponents,
  isDynamicType,
  type TronAbiParametersToPrimitiveTypes,
} from './encodeAbiParameters.js'
import { formatAbiParams } from './formatAbiItem.js'

export type DecodeAbiParametersReturnType<
  params extends
    | readonly AbiParameter[]
    | readonly unknown[] = readonly AbiParameter[],
> = params extends readonly AbiParameter[]
  ? TronAbiParametersToPrimitiveTypes<params, 'outputs'>
  : readonly unknown[]

export type DecodeAbiParametersErrorType =
  | AbiDecodingDataSizeInvalidErrorType
  | AbiDecodingDataSizeTooSmallErrorType
  | AbiDecodingZeroDataErrorType
  | AbiDecodingZeroSizeElementErrorType
  | CreateCursorErrorType
  | IntegerOutOfRangeErrorType
  | InvalidAbiDecodingTypeErrorType
  | InvalidBytesBooleanErrorType
  | InvalidHexValueErrorType
  | PositionOutOfBoundsErrorType
  | ToBase58ErrorType
  | ErrorType

/**
 * Decodes ABI-encoded data into primitive values, per the Solidity ABI
 * specification (the inverse of `encodeAbiParameters`). All reads go through
 * a bounds-checked cursor, so truncated data, out-of-bounds offsets, and
 * garbage length slots throw instead of decoding junk.
 *
 * TRON behavior: `address` decodes the last 20 bytes of its slot to the
 * canonical Base58Check form (`T…`); `trcToken` decodes exactly like
 * `uint256`. Tuples decode to objects when every component is named,
 * otherwise to positional arrays.
 *
 * @example
 * decodeAbiParameters(
 *   [{ type: 'address' }, { type: 'uint256' }],
 *   '0x...', // a 32-byte address word followed by a uint256 word
 * )
 * // ['T...', 1000000n]
 */
export function decodeAbiParameters<
  const params extends readonly AbiParameter[] | readonly unknown[],
>(
  params: params,
  data: Hex | ByteArray,
): DecodeAbiParametersReturnType<params> {
  // The payload is bytes, so an odd nibble count is not a byte string at all.
  // `hexToBytes` would left-pad it, shifting every byte by four bits and
  // decoding a plausible-looking wrong value, so reject it before converting.
  if (typeof data === 'string' && data.length % 2 !== 0)
    throw new InvalidHexValueError(data as Hex)
  const bytes = typeof data === 'string' ? hexToBytes(data) : data
  if (bytes.length === 0 && params.length > 0)
    throw new AbiDecodingZeroDataError()
  // Canonical ABI data is a whole number of 32-byte words (every head slot is
  // one word and every tail is word-padded); anything else is truncated or
  // corrupt, not something to decode a partial word from.
  if (bytes.length % 32 !== 0)
    throw new AbiDecodingDataSizeInvalidError({
      data: typeof data === 'string' ? (data as Hex) : bytesToHex(data),
      size: bytes.length,
    })
  if (bytes.length > 0 && bytes.length < 32 * params.length)
    throw new AbiDecodingDataSizeTooSmallError({
      data: typeof data === 'string' ? data : bytesToHex(data),
      formattedParams: formatAbiParams(params as readonly AbiParameter[], {
        includeName: true,
      }),
      params: params as readonly AbiParameter[],
      size: bytes.length,
    })

  const cursor = createCursor(bytes)
  let consumed = 0
  const values: unknown[] = []
  for (let i = 0; i < params.length; ++i) {
    const param = (params as readonly AbiParameter[])[i]!
    cursor.setPosition(consumed)
    const [value, consumed_] = decodeParameter(cursor, param, {
      staticPosition: 0,
    })
    consumed += consumed_
    values.push(value)
  }
  return values as unknown as DecodeAbiParametersReturnType<params>
}

/////////////////////////////////////////////////////////////////////////////
// Internal

type TupleAbiParameter = AbiParameter & { components: readonly AbiParameter[] }

/**
 * Decodes one parameter with the cursor positioned at its head slot and
 * returns `[value, consumed]`, where `consumed` is the number of head bytes
 * used (32 for every dynamic parameter — its offset slot — or the inline
 * size for static ones). Dynamic decoders jump to `staticPosition + offset`
 * and restore the cursor afterwards, so callers can keep reading heads
 * sequentially.
 */
function decodeParameter(
  cursor: Cursor,
  param: AbiParameter,
  { staticPosition }: { staticPosition: number },
): [value: unknown, consumed: number] {
  // Every other bad-input path here throws a BaseError, and
  // `DecodeAbiParametersErrorType` promises exactly that set — so a descriptor
  // that is null or carries no string `type` must not escape as a TypeError.
  const type = (param as { type?: unknown } | null | undefined)?.type
  if (typeof type !== 'string')
    throw new InvalidAbiDecodingTypeError(String(type), {
      docsPath: '/docs/abi/decodeAbiParameters',
    })
  const arrayComponents = getArrayComponents(param.type)
  if (arrayComponents) {
    const [length, type] = arrayComponents
    return decodeArray(cursor, { ...param, type }, { length, staticPosition })
  }
  if (param.type === 'tuple')
    return decodeTuple(cursor, param as TupleAbiParameter, { staticPosition })
  if (param.type === 'address') return decodeAddress(cursor)
  if (param.type === 'bool') return decodeBool(cursor)
  // `trcToken` decodes exactly like `uint256`.
  if (param.type === 'trcToken')
    return decodeNumber(cursor, { bits: 256, signed: false })
  const integerMatch = param.type.match(integerRegex)
  if (integerMatch) {
    const [, baseType, bits] = integerMatch
    return decodeNumber(cursor, {
      bits: bits ? Number(bits) : 256,
      signed: baseType === 'int',
    })
  }
  const bytesMatch = param.type.match(bytesRegex)
  if (bytesMatch)
    return decodeBytes(cursor, {
      size: bytesMatch[1] ? Number(bytesMatch[1]) : null,
      staticPosition,
    })
  if (param.type === 'string') return decodeString(cursor, { staticPosition })
  throw new InvalidAbiDecodingTypeError(param.type, {
    docsPath: '/docs/abi/decodeAbiParameters',
  })
}

function decodeAddress(cursor: Cursor): [Address, number] {
  const word = cursor.readBytes(32)
  // Slot body = 20-byte EVM-form address, left-padded; return Base58Check.
  return [toBase58(bytesToHex(word.subarray(12))), 32]
}

function decodeArray(
  cursor: Cursor,
  param: AbiParameter,
  { length, staticPosition }: { length: number | null; staticPosition: number },
): [unknown[], number] {
  const dynamicChild = isDynamicType(param)

  // Dynamic-size array: head slot is an offset to `[length, elements…]`.
  if (length === null) {
    const offset = bytesToNumber(cursor.readBytes(32))
    const start = staticPosition + offset
    const startOfData = start + 32
    const restore = cursor.setPosition(start)
    const arrayLength = bytesToNumber(cursor.readBytes(32))
    let consumed = 0
    const value: unknown[] = []
    for (let i = 0; i < arrayLength; ++i) {
      // Dynamic children have 32-byte offset slots (relative to the start of
      // the element block); static children lie inline back-to-back.
      cursor.setPosition(startOfData + (dynamicChild ? i * 32 : consumed))
      const [element, consumed_] = decodeParameter(cursor, param, {
        staticPosition: startOfData,
      })
      // `arrayLength` is attacker-controlled and the loop's only backstop is
      // the cursor running out of bounds, so an element occupying zero bytes
      // (degenerate `tuple` with no components, `X[0]`) would spin here.
      if (consumed_ === 0) throw new AbiDecodingZeroSizeElementError(param.type)
      consumed += consumed_
      value.push(element)
    }
    restore()
    return [value, 32]
  }

  // Fixed-size array with dynamic children: one offset slot for the whole
  // array; children offsets are relative to the start of the element block.
  if (dynamicChild) {
    const offset = bytesToNumber(cursor.readBytes(32))
    // A zero-length array has no elements to read, and its empty tail sits at
    // the very end of the data — a position the cursor rightly refuses to take.
    // Consume the head slot and stop; there is nothing the offset points at.
    if (length === 0) return [[], 32]
    const start = staticPosition + offset
    const restore = cursor.setPosition(start)
    const value: unknown[] = []
    for (let i = 0; i < length; ++i) {
      cursor.setPosition(start + i * 32)
      const [element] = decodeParameter(cursor, param, {
        staticPosition: start,
      })
      value.push(element)
    }
    restore()
    return [value, 32]
  }

  // Fixed-size array of static children: elements lie inline in the head.
  let consumed = 0
  const value: unknown[] = []
  for (let i = 0; i < length; ++i) {
    const [element, consumed_] = decodeParameter(cursor, param, {
      staticPosition,
    })
    if (consumed_ === 0) throw new AbiDecodingZeroSizeElementError(param.type)
    consumed += consumed_
    value.push(element)
  }
  return [value, consumed]
}

function decodeBool(cursor: Cursor): [boolean, number] {
  return [bytesToBool(cursor.readBytes(32), { size: 32 }), 32]
}

function decodeBytes(
  cursor: Cursor,
  {
    size: paramSize,
    staticPosition,
  }: { size: number | null; staticPosition: number },
): [Hex, number] {
  // Dynamic `bytes`: head slot is an offset to `[length, payload…]`.
  if (paramSize === null) {
    const offset = bytesToNumber(cursor.readBytes(32))
    const start = staticPosition + offset
    const restore = cursor.setPosition(start)
    const length = bytesToNumber(cursor.readBytes(32))
    const value: Hex =
      length === 0 ? '0x' : bytesToHex(cursor.readBytes(length))
    restore()
    return [value, 32]
  }
  // Static `bytesN`: left-aligned in its slot.
  const word = cursor.readBytes(32)
  return [bytesToHex(word.subarray(0, paramSize)), 32]
}

function decodeNumber(
  cursor: Cursor,
  { bits, signed }: { bits: number; signed: boolean },
): [bigint, number] {
  const value = bytesToBigInt(cursor.readBytes(32), { signed })
  if (bits < 256) {
    const max = signed
      ? (1n << (BigInt(bits) - 1n)) - 1n
      : (1n << BigInt(bits)) - 1n
    const min = signed ? -(1n << (BigInt(bits) - 1n)) : 0n
    if (value > max || value < min)
      throw new IntegerOutOfRangeError({
        max: max.toString(),
        min: min.toString(),
        signed,
        size: bits / 8,
        value: value.toString(),
      })
  }
  return [value, 32]
}

function decodeString(
  cursor: Cursor,
  { staticPosition }: { staticPosition: number },
): [string, number] {
  const offset = bytesToNumber(cursor.readBytes(32))
  const start = staticPosition + offset
  const restore = cursor.setPosition(start)
  const length = bytesToNumber(cursor.readBytes(32))
  const value = length === 0 ? '' : bytesToString(cursor.readBytes(length))
  restore()
  return [value, 32]
}

function decodeTuple(
  cursor: Cursor,
  param: TupleAbiParameter,
  { staticPosition }: { staticPosition: number },
): [unknown, number] {
  const components = param.components ?? []
  // Named form (object) only when every component is named.
  const named =
    components.length > 0 && components.every((component) => component.name)
  const value: Record<string, unknown> | unknown[] = named ? {} : []
  const setValue = (component: AbiParameter, element: unknown) => {
    if (named) (value as Record<string, unknown>)[component.name!] = element
    else (value as unknown[]).push(element)
  }

  // Dynamic tuple: head slot is an offset to the component block, inside
  // which component offsets are relative to the block start.
  if (isDynamicType(param)) {
    const offset = bytesToNumber(cursor.readBytes(32))
    const start = staticPosition + offset
    const restore = cursor.setPosition(start)
    let consumed = 0
    for (const component of components) {
      cursor.setPosition(start + consumed)
      const [element, consumed_] = decodeParameter(cursor, component, {
        staticPosition: start,
      })
      consumed += consumed_
      setValue(component, element)
    }
    restore()
    return [value, 32]
  }

  // Static tuple: components lie inline in the head.
  let consumed = 0
  for (const component of components) {
    const [element, consumed_] = decodeParameter(cursor, component, {
      staticPosition,
    })
    consumed += consumed_
    setValue(component, element)
  }
  return [value, consumed]
}
