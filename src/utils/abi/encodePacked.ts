// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { AbiType } from 'abitype'

import {
  AbiEncodingBytesSizeMismatchError,
  type AbiEncodingBytesSizeMismatchErrorType,
  AbiEncodingLengthMismatchError,
  type AbiEncodingLengthMismatchErrorType,
  InvalidArrayError,
  type InvalidArrayErrorType,
  UnsupportedPackedAbiType,
  type UnsupportedPackedAbiTypeErrorType,
} from '../../errors/abi.js'
import { IntegerOutOfRangeError } from '../../errors/encoding.js'
import type { ErrorType } from '../../errors/utils.js'
import type { AddressInput } from '../../types/address.js'
import type { Hex } from '../../types/misc.js'
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
import { bytesRegex, integerRegex } from '../regex.js'
import {
  getArrayComponents,
  type TronAbiParameterToPrimitiveType,
} from './encodeAbiParameters.js'

/** Runtime types accepted by `encodePacked`. */
export type PackedAbiType = AbiType

/** Positional primitive types for a list of packable ABI types. */
export type EncodePackedValues<types extends readonly unknown[]> = {
  [key in keyof types]: types[key] extends AbiType
    ? TronAbiParameterToPrimitiveType<{ type: types[key] }, 'inputs'>
    : unknown
}

export type EncodePackedErrorType =
  | AbiEncodingBytesSizeMismatchErrorType
  | AbiEncodingLengthMismatchErrorType
  | AddressToHexErrorType
  | BoolToHexErrorType
  | ConcatHexErrorType
  | NumberToHexErrorType
  | PadHexErrorType
  | SizeErrorType
  | StringToHexErrorType
  | UnsupportedPackedAbiTypeErrorType
  | InvalidArrayErrorType
  | ErrorType

/**
 * Non-standard (tightly) packed encoding, as produced by Solidity's
 * `abi.encodePacked`: each value is laid out back-to-back with no head/tail,
 * length prefixes, or 32-byte alignment.
 *
 * Packing rules:
 * - static types occupy their own natural width — `address` is 20 bytes
 *   (TRON forms are converted to their EVM 20-byte body first), `uintN`/`intN`
 *   is `N / 8` bytes, `bool` is 1 byte, `bytesN` is `N` bytes;
 * - dynamic `bytes` and `string` are emitted raw with no padding;
 * - array elements are each padded to a full 32-byte word;
 * - nested dynamic types, nested arrays, and tuples are not packable and throw.
 *
 * @example
 * encodePacked(
 *   ['address', 'uint256'],
 *   ['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 1000000n],
 * )
 * // '0xa614f803b6fd780986a42c78ec9c7f77e6ded13c00000000000000000000000000000000000000000000000000000000000f4240'
 */
export function encodePacked<
  const packedAbiTypes extends readonly PackedAbiType[] | readonly unknown[],
>(types: packedAbiTypes, values: EncodePackedValues<packedAbiTypes>): Hex {
  if (types.length !== (values as readonly unknown[]).length)
    throw new AbiEncodingLengthMismatchError({
      expectedLength: types.length,
      givenLength: (values as readonly unknown[]).length,
    })

  const data: Hex[] = []
  for (let i = 0; i < (types as readonly string[]).length; i++) {
    const type = (types as readonly string[])[i]!
    const value = (values as readonly unknown[])[i]
    data.push(encode(type, value))
  }
  return concatHex(data)
}

/////////////////////////////////////////////////////////////////////////////
// Internal

function encode(type: string, value: unknown, isArray = false): Hex {
  if (type === 'address') {
    const hex = addressToHex(value as AddressInput)
    return isArray ? padHex(hex, { size: 32 }) : hex
  }
  if (type === 'string') {
    if (isArray) throw new UnsupportedPackedAbiType(`${type}[]`)
    return stringToHex(value as string)
  }
  if (type === 'bytes') {
    if (isArray) throw new UnsupportedPackedAbiType(`${type}[]`)
    if (!isHex(value)) throw new UnsupportedPackedAbiType(type)
    return value
  }
  if (type === 'bool') {
    if (typeof value !== 'boolean') throw new UnsupportedPackedAbiType(type)
    return padHex(boolToHex(value), { size: isArray ? 32 : 1 })
  }

  const integerMatch = type.match(integerRegex)
  if (integerMatch) {
    const [, baseType, bits = '256'] = integerMatch
    const signed = baseType === 'int'
    if (typeof value !== 'number' && typeof value !== 'bigint')
      throw new UnsupportedPackedAbiType(type)
    const byteSize = isArray ? 32 : Number(bits) / 8
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
        size: Number(bits) / 8,
        value: value_.toString(),
      })
    return numberToHex(value_, { size: byteSize, signed })
  }

  const bytesMatch = type.match(bytesRegex)
  if (bytesMatch) {
    const byteSize = Number(bytesMatch[1])
    if (!isHex(value)) throw new UnsupportedPackedAbiType(type)
    if (size(value) !== byteSize)
      throw new AbiEncodingBytesSizeMismatchError({
        expectedSize: byteSize,
        value,
      })
    return isArray ? padHex(value, { dir: 'right', size: 32 }) : value
  }

  const arrayComponents = getArrayComponents(type)
  if (arrayComponents) {
    // Only arrays of static scalars are packable; a nested array while
    // already inside an array is not.
    if (isArray) throw new UnsupportedPackedAbiType(type)
    const [, childType] = arrayComponents
    if (!Array.isArray(value)) throw new InvalidArrayError(value)
    const data: Hex[] = []
    for (const element of value) data.push(encode(childType, element, true))
    return data.length > 0 ? concatHex(data) : '0x'
  }

  throw new UnsupportedPackedAbiType(type)
}
