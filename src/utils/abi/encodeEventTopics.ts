// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { Abi, AbiEvent, AbiParameter } from 'abitype'

import {
  AbiEventNotFoundError,
  type AbiEventNotFoundErrorType,
} from '../../errors/abi.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Hex, LogTopic } from '../../types/misc.js'
import { type StringToHexErrorType, stringToHex } from '../encoding/toHex.js'
import { type Keccak256ErrorType, keccak256 } from '../hash/keccak256.js'
import {
  type ToEventSelectorErrorType,
  toEventSelector,
} from '../hash/toEventSelector.js'
import {
  type EncodeAbiParametersErrorType,
  encodeAbiParameters,
  getArrayComponents,
} from './encodeAbiParameters.js'
import { formatAbiItem } from './formatAbiItem.js'

export type EncodeEventTopicsParameters = {
  /** ABI containing the event definition. */
  abi: Abi | readonly unknown[]
  /** Name of the event to encode topics for (optional if the ABI has one). */
  eventName?: string | undefined
  /**
   * Indexed argument values, positional over the indexed inputs or keyed by
   * name. A `null`/`undefined` entry leaves that topic as a wildcard.
   */
  args?: readonly unknown[] | Record<string, unknown> | undefined
}

export type EncodeEventTopicsReturnType = LogTopic[]

export type EncodeEventTopicsErrorType =
  | AbiEventNotFoundErrorType
  | EncodeAbiParametersErrorType
  | Keccak256ErrorType
  | StringToHexErrorType
  | ToEventSelectorErrorType
  | ErrorType

/**
 * Builds the log `topics` array for an event, per the Solidity ABI event
 * model: the first topic is the event selector (`keccak256` of the event
 * signature) unless the event is `anonymous`, followed by one topic per
 * indexed parameter. Indexed static values are ABI-encoded into a 32-byte
 * word; indexed dynamic values (`string`, `bytes`, arrays, tuples) are hashed
 * with `keccak256` (the raw bytes for `string`/`bytes`), since only their hash
 * is recoverable from a log.
 *
 * TRON behavior: indexed `address` topics encode the 20-byte EVM body,
 * left-padded to 32 bytes.
 *
 * @example
 * encodeEventTopics({
 *   abi,
 *   eventName: 'Transfer',
 *   args: { from: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC', to: 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K' },
 * })
 */
export function encodeEventTopics(
  parameters: EncodeEventTopicsParameters,
): EncodeEventTopicsReturnType {
  const { abi, eventName, args } = parameters

  const abiItem = selectEvent(abi, eventName)
  const inputs = (abiItem.inputs ?? []) as readonly AbiParameter[]
  const indexedInputs = inputs.filter(
    (input) => 'indexed' in input && input.indexed,
  )

  const argTopics: LogTopic[] = []
  if (args && indexedInputs.length > 0) {
    for (let i = 0; i < indexedInputs.length; i++) {
      const param = indexedInputs[i]!
      const value = Array.isArray(args)
        ? args[i]
        : (args as Record<string, unknown>)[param.name ?? '']
      if (value === undefined || value === null) {
        argTopics.push(null)
        continue
      }
      argTopics.push(
        Array.isArray(value) && isHashedType(param.type)
          ? value.map((v) => encodeArg(param, v))
          : encodeArg(param, value),
      )
    }
  }

  const signature = abiItem.anonymous
    ? undefined
    : (toEventSelector(formatAbiItem(abiItem)) as Hex)

  return signature ? [signature, ...argTopics] : argTopics
}

/////////////////////////////////////////////////////////////////////////////
// Internal

/** Whether an indexed value of this type is stored as its `keccak256` hash. */
function isHashedType(type: string): boolean {
  return (
    type === 'string' ||
    type === 'bytes' ||
    type === 'tuple' ||
    getArrayComponents(type) !== undefined
  )
}

function selectEvent(
  abi: Abi | readonly unknown[],
  eventName: string | undefined,
): AbiEvent {
  const events = (abi as readonly { type?: string; name?: string }[]).filter(
    (item): item is AbiEvent =>
      item.type === 'event' && (!eventName || item.name === eventName),
  )
  const abiItem = events[0]
  if (!abiItem)
    throw new AbiEventNotFoundError(eventName, {
      docsPath: '/docs/abi/encodeEventTopics',
    })
  return abiItem
}

/** Encodes a single indexed argument into its 32-byte topic word. */
function encodeArg(param: AbiParameter, value: unknown): Hex {
  if (param.type === 'string') return keccak256(stringToHex(value as string))
  if (param.type === 'bytes') return keccak256(value as Hex)
  if (isHashedType(param.type))
    // Indexed arrays / tuples are hashed over their ABI encoding.
    return keccak256(encodeAbiParameters([param], [value] as never))
  return encodeAbiParameters([param], [value] as never)
}
