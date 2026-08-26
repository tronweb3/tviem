import type { Abi, AbiParameter } from 'abitype'

import {
  AbiItemAmbiguityError,
  type AbiItemAmbiguityErrorType,
} from '../../errors/abi.js'
import type { ErrorType } from '../../errors/utils.js'
import type {
  AbiItem,
  AbiItemArgs,
  AbiItemName,
  ExtractAbiItemForArgs,
} from '../../types/contract.js'
import type { Hex } from '../../types/misc.js'
import { isAddress } from '../address/isAddress.js'
import { isHex } from '../data/isHex.js'
import { toEventSelector } from '../hash/toEventSelector.js'
import { toFunctionSelector } from '../hash/toFunctionSelector.js'
import { formatAbiItem } from './formatAbiItem.js'

export type GetAbiItemParameters<
  abi extends Abi | readonly unknown[] = Abi,
  name extends AbiItemName<abi> = AbiItemName<abi>,
  args extends AbiItemArgs<abi, name> = AbiItemArgs<abi, name>,
> = {
  abi: abi
  args?: args | readonly unknown[] | undefined
  /** Item name, or a 4-byte function / 32-byte event selector (`0x…`). */
  name: name | Hex
}

export type GetAbiItemReturnType<
  abi extends Abi | readonly unknown[] = Abi,
  name extends AbiItemName<abi> = AbiItemName<abi>,
  args extends AbiItemArgs<abi, name> = AbiItemArgs<abi, name>,
> = abi extends Abi
  ? Abi extends abi
    ? AbiItem | undefined
    : ExtractAbiItemForArgs<abi, name, args> | undefined
  : AbiItem | undefined

export type GetAbiItemErrorType = AbiItemAmbiguityErrorType | ErrorType

/** Matches `uint`/`int` at any valid bit width (a bare `uint`/`int` = 256). */
const INTEGER_TYPE =
  /^u?int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/

/**
 * Matches the trailing `[]` / `[M]` of an array type — stripping it yields
 * the element type, and the capture holds `M` (empty for dynamic arrays).
 */
const ARRAY_SUFFIX = /\[([0-9]*)\]$/

/**
 * Finds an ABI item by `name` or by 4-byte function / 32-byte event selector
 * (`0x…` hex). When several overloads share a name, `args` disambiguates them
 * by matching each argument against the candidate parameter types (`address`
 * matching is TRON-aware, accepting any address form). A combination that two
 * overloads could both encode throws {@link AbiItemAmbiguityError}.
 *
 * @example
 * getAbiItem({ abi, name: 'transfer' })
 * getAbiItem({ abi, name: '0xa9059cbb' })
 */
export function getAbiItem<
  const abi extends Abi | readonly unknown[],
  name extends AbiItemName<abi>,
  const args extends AbiItemArgs<abi, name>,
>(
  parameters: GetAbiItemParameters<abi, name, args>,
): GetAbiItemReturnType<abi, name, args> {
  const {
    abi,
    args = [],
    name,
  } = parameters as {
    abi: Abi
    args?: readonly unknown[]
    name: string
  }

  const isSelector = isHex(name, { strict: false })
  const abiItems = abi.filter((abiItem) => {
    if (isSelector) {
      if (abiItem.type === 'function')
        return toFunctionSelector(abiItem) === name
      if (abiItem.type === 'event') return toEventSelector(abiItem) === name
      return false
    }
    return 'name' in abiItem && abiItem.name === name
  })

  if (abiItems.length === 0)
    return undefined as GetAbiItemReturnType<abi, name, args>
  if (abiItems.length === 1)
    return abiItems[0] as GetAbiItemReturnType<abi, name, args>

  let matchedAbiItem: AbiItem | undefined
  for (const abiItem of abiItems) {
    if (!('inputs' in abiItem)) continue
    if (!args || args.length === 0) {
      if (!abiItem.inputs || abiItem.inputs.length === 0)
        return abiItem as GetAbiItemReturnType<abi, name, args>
      continue
    }
    if (!abiItem.inputs) continue
    if (abiItem.inputs.length === 0) continue
    if (abiItem.inputs.length !== args.length) continue
    const matched = args.every((arg, index) => {
      const abiParameter = abiItem.inputs![index]
      if (!abiParameter) return false
      return isArgOfType(arg, abiParameter)
    })
    if (matched) {
      // Two overloads that both structurally accept `args` are ambiguous only
      // when a parameter position has types that encode identically.
      if (
        matchedAbiItem &&
        'inputs' in matchedAbiItem &&
        matchedAbiItem.inputs
      ) {
        const ambiguousTypes = getAmbiguousTypes(
          abiItem.inputs,
          matchedAbiItem.inputs,
          args,
        )
        if (ambiguousTypes)
          throw new AbiItemAmbiguityError(
            {
              formattedAbiItem: formatAbiItem(abiItem),
              type: ambiguousTypes[0]!,
            },
            {
              formattedAbiItem: formatAbiItem(matchedAbiItem),
              type: ambiguousTypes[1]!,
            },
          )
      }
      // Advance to this match so the next candidate is disambiguated against
      // the immediately-previous match (and the last structural match wins),
      // matching the reference overload-resolution semantics.
      matchedAbiItem = abiItem
    }
  }

  if (matchedAbiItem)
    return matchedAbiItem as GetAbiItemReturnType<abi, name, args>
  return abiItems[0] as GetAbiItemReturnType<abi, name, args>
}

/**
 * Whether a runtime argument could be an ABI value of the given parameter's
 * type. `address` uses TRON-aware validation (any address form passes);
 * `trcToken` behaves like an integer. Used to disambiguate overloads.
 */
export function isArgOfType(arg: unknown, abiParameter: AbiParameter): boolean {
  const argType = typeof arg
  const abiParameterType = abiParameter.type
  switch (abiParameterType) {
    case 'address':
      return typeof arg === 'string' && isAddress(arg, { strict: false })
    case 'bool':
      return argType === 'boolean'
    case 'function':
      return argType === 'string'
    case 'string':
      return argType === 'string'
    case 'trcToken':
      return argType === 'number' || argType === 'bigint'
    default: {
      if (
        abiParameterType === 'tuple' &&
        'components' in abiParameter &&
        Array.isArray(abiParameter.components)
      ) {
        // Only a non-null object/array can be a tuple value. Without the
        // `object` guard a primitive string would "match" (Object.values(
        // 'ab') is ['a','b']) and steal the overload from foo(string); the
        // explicit null check keeps Object.values(null) from throwing,
        // since typeof null === 'object' too.
        if (arg === null || argType !== 'object') return false
        const values = Object.values(arg as Record<string, unknown>)
        // Arity is part of the tuple's identity: without this, an arg with
        // extra values also matches a shorter tuple, so two overloads that
        // differ only in component count both "match" — and the shorter one
        // encodes, silently dropping the caller's trailing values.
        if (values.length !== abiParameter.components.length) return false
        return abiParameter.components.every((component, index) => {
          if (Array.isArray(arg))
            return isArgOfType(values[index], component as AbiParameter)
          // Encoding reads an object tuple value by component name (see
          // encodeTuple), so matching must too — key order is irrelevant,
          // wrong key names never "match" positionally, and an object can
          // never satisfy an unnamed component.
          const name = (component as AbiParameter).name
          if (name === undefined) return false
          return isArgOfType(
            (arg as Record<string, unknown>)[name],
            component as AbiParameter,
          )
        })
      }

      // `(u)intN`
      if (INTEGER_TYPE.test(abiParameterType))
        return argType === 'number' || argType === 'bigint'

      // `bytes`, `bytesN`
      if (/^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])?$/.test(abiParameterType))
        return argType === 'string' || arg instanceof Uint8Array

      // arrays of any of the above; detected by the bare suffix so element
      // widths containing a 0 digit (uint160[], bytes20[]) are not skipped
      const arraySuffix = ARRAY_SUFFIX.exec(abiParameterType)
      if (arraySuffix) {
        if (!Array.isArray(arg)) return false
        // A fixed-size array only accepts exactly M values.
        if (arraySuffix[1] !== '' && arg.length !== Number(arraySuffix[1]))
          return false
        return arg.every((x: unknown) =>
          isArgOfType(x, {
            ...abiParameter,
            // Pop off `[]` or `[M]`.
            type: abiParameterType.replace(ARRAY_SUFFIX, ''),
          } as AbiParameter),
        )
      }

      return false
    }
  }
}

/**
 * Returns the first pair of parameter types (source, target) that could both
 * encode the corresponding argument, or `undefined` when the two parameter
 * lists are unambiguous. Tuples recurse component-wise and arrays
 * element-wise; an empty array still compares the element types once, so
 * arg-independent pairs (`address`/`bytes20`) stay ambiguous. On TRON,
 * `address` is ambiguous with `bytes20`, and with `string`/`bytes` when the
 * argument is a valid address.
 */
export function getAmbiguousTypes(
  sourceParameters: readonly AbiParameter[],
  targetParameters: readonly AbiParameter[],
  args: readonly unknown[],
): [string, string] | undefined {
  for (const parameterIndex in sourceParameters) {
    const sourceParameter = sourceParameters[parameterIndex]!
    const targetParameter = targetParameters[parameterIndex]
    // The tuple recursion below passes the two overloads' component lists,
    // which need not be the same length. Where they diverge there is nothing
    // to compare against, and lists of different arity cannot encode
    // identically — so they are not ambiguous.
    if (!targetParameter) return undefined

    if (
      sourceParameter.type === 'tuple' &&
      targetParameter.type === 'tuple' &&
      'components' in sourceParameter &&
      'components' in targetParameter
    ) {
      const components = sourceParameter.components as readonly AbiParameter[]
      const arg = args[parameterIndex as unknown as number]
      // An object tuple value is read by component name at encode time (see
      // encodeTuple) and matched by name in `isArgOfType`, so it has to be
      // laid out positionally here too: indexing the object directly yields
      // `undefined` for every component, and the arg-dependent rules below
      // then never fire — the array form of the same call would throw while
      // the object form silently resolved. Both overloads had to match the
      // same object to reach this point, so their component names are the
      // same set and the source list is a faithful index. The array branch
      // below probes empty arrays with a placeholder element, so a tuple's
      // arg can legitimately be absent here.
      const tupleArgs =
        arg !== null && typeof arg === 'object' && !Array.isArray(arg)
          ? components.map(
              (component) =>
                (arg as Record<string, unknown>)[component.name ?? ''],
            )
          : ((arg ?? []) as readonly unknown[])
      const ambiguous = getAmbiguousTypes(
        components,
        targetParameter.components as readonly AbiParameter[],
        tupleArgs,
      )
      // An unambiguous tuple only settles this position — the remaining
      // parameters still have to be compared.
      if (ambiguous) return ambiguous
      continue
    }

    if (
      ARRAY_SUFFIX.test(sourceParameter.type) &&
      ARRAY_SUFFIX.test(targetParameter.type)
    ) {
      const sourceElement = {
        ...sourceParameter,
        type: sourceParameter.type.replace(ARRAY_SUFFIX, ''),
      } as AbiParameter
      const targetElement = {
        ...targetParameter,
        type: targetParameter.type.replace(ARRAY_SUFFIX, ''),
      } as AbiParameter
      const arg = args[parameterIndex as unknown as number]
      // Compare the element types against every element of the argument.
      // With no elements to inspect, probe once with no argument so
      // arg-independent pairs (address/bytes20) are still detected, while
      // arg-dependent ones (address/string) correctly stay unambiguous.
      const elements = Array.isArray(arg) && arg.length > 0 ? arg : [undefined]
      const ambiguous = getAmbiguousTypes(
        elements.map(() => sourceElement),
        elements.map(() => targetElement),
        elements,
      )
      if (ambiguous) return ambiguous
      continue
    }

    const types = [sourceParameter.type, targetParameter.type] as [
      string,
      string,
    ]

    const ambiguous = (() => {
      if (types.includes('address') && types.includes('bytes20')) return true
      if (types.includes('address') && types.includes('string'))
        return isAddressArg(args[parameterIndex as unknown as number])
      if (types.includes('address') && types.includes('bytes'))
        return isAddressArg(args[parameterIndex as unknown as number])
      // Every integer-like type (`(u)intN` at any width, and the TRON
      // `trcToken`) encodes a number/bigint into the same left-padded 32-byte
      // word, while differing canonical widths still produce DIFFERENT
      // selectors — so a numeric arg cannot pick between the overloads, and
      // resolving one silently would call a different function. Equal
      // canonical types (`uint` is `uint256` to the selector) encode AND
      // select identically, so they settle nothing at this position.
      if (
        types.every(isIntegerLikeType) &&
        canonicalIntegerType(types[0]) !== canonicalIntegerType(types[1])
      ) {
        const arg = args[parameterIndex as unknown as number]
        return typeof arg === 'number' || typeof arg === 'bigint'
      }
      return false
    })()

    if (ambiguous) return types
  }

  return undefined
}

function isAddressArg(arg: unknown): boolean {
  return typeof arg === 'string' && isAddress(arg, { strict: false })
}

/** Whether a type encodes a number/bigint into a 32-byte word (`(u)intN` or the TRON `trcToken`). */
function isIntegerLikeType(type: string): boolean {
  return type === 'trcToken' || INTEGER_TYPE.test(type)
}

/**
 * Canonical form of an integer-like type: a bare `uint`/`int` is `uint256`/
 * `int256` in the selector signature (see `normalizeSignature`).
 */
function canonicalIntegerType(type: string): string {
  if (type === 'uint') return 'uint256'
  if (type === 'int') return 'int256'
  return type
}
