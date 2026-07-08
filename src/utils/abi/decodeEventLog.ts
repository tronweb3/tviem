// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { Abi, AbiEvent, AbiParameter } from 'abitype'

import {
  AbiEventNotFoundError,
  type AbiEventNotFoundErrorType,
  AbiEventSignatureEmptyTopicsError,
  type AbiEventSignatureEmptyTopicsErrorType,
  AbiEventSignatureNotFoundError,
  type AbiEventSignatureNotFoundErrorType,
  DecodeLogDataMismatch,
  type DecodeLogDataMismatchErrorType,
  DecodeLogTopicsMismatch,
  type DecodeLogTopicsMismatchErrorType,
} from '../../errors/abi.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Hex } from '../../types/misc.js'
import { size } from '../data/size.js'
import {
  type ToEventSelectorErrorType,
  toEventSelector,
} from '../hash/toEventSelector.js'
import {
  type DecodeAbiParametersErrorType,
  decodeAbiParameters,
} from './decodeAbiParameters.js'
import { getArrayComponents } from './encodeAbiParameters.js'
import { formatAbiItem } from './formatAbiItem.js'

export type DecodeEventLogParameters = {
  /** ABI containing the event definition. */
  abi: Abi | readonly unknown[]
  /** Ordered log topics (`topics[0]` is the selector for non-anonymous events). */
  topics: readonly Hex[]
  /** Non-indexed event data. */
  data?: Hex | undefined
  /** Event name (required to decode `anonymous` events). */
  eventName?: string | undefined
}

export type DecodeEventLogReturnType = {
  eventName: string
  args: Record<string, unknown> | readonly unknown[] | undefined
}

export type DecodeEventLogErrorType =
  | AbiEventNotFoundErrorType
  | AbiEventSignatureEmptyTopicsErrorType
  | AbiEventSignatureNotFoundErrorType
  | DecodeAbiParametersErrorType
  | DecodeLogDataMismatchErrorType
  | DecodeLogTopicsMismatchErrorType
  | ToEventSelectorErrorType
  | ErrorType

const docsPath = '/docs/abi/decodeEventLog'

/**
 * Decodes an event log into its parameter values, per the Solidity ABI event
 * model (the inverse of `encodeEventTopics` + `encodeAbiParameters`): the
 * event is resolved from `topics[0]` (the selector) or from `eventName`,
 * indexed parameters are read from `topics`, and non-indexed parameters are
 * decoded from `data`.
 *
 * TRON behavior: indexed/non-indexed `address` parameters decode to the
 * canonical Base58Check form (`T…`). Indexed dynamic parameters (`string`,
 * `bytes`, arrays, tuples) are only present as their `keccak256` hash in the
 * topic, so they decode to that 32-byte hash hex (not the original value).
 *
 * @example
 * decodeEventLog({ abi, topics, data })
 * // { eventName: 'Transfer', args: { from: 'T…', to: 'T…', value: 1000000n } }
 */
export function decodeEventLog(
  parameters: DecodeEventLogParameters,
): DecodeEventLogReturnType {
  const { abi, topics, data, eventName } = parameters
  const [topic0, ...argTopics_] = topics

  const abiItem = selectEvent(abi, { eventName, topic0 })
  const inputs = (abiItem.inputs ?? []) as readonly AbiParameter[]

  // Anonymous events carry no selector, so every topic is an argument topic.
  const argTopics = abiItem.anonymous ? topics : argTopics_

  const isUnnamed = inputs.some((input) => !input.name)
  const args: Record<string, unknown> | unknown[] = isUnnamed ? [] : {}
  const setArg = (input: AbiParameter, index: number, value: unknown) => {
    if (isUnnamed) (args as unknown[])[index] = value
    else (args as Record<string, unknown>)[input.name!] = value
  }

  // Indexed parameters come from the topics, in declaration order.
  let topicIndex = 0
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]!
    if (!('indexed' in input && input.indexed)) continue
    const topic = argTopics[topicIndex]
    if (topic === undefined)
      throw new DecodeLogTopicsMismatch({
        abiItem,
        param: input as AbiParameter & { indexed: boolean },
      })
    setArg(input, i, decodeTopic(input, topic))
    topicIndex++
  }

  // Non-indexed parameters come from `data`.
  const nonIndexedInputs = inputs.filter(
    (input) => !('indexed' in input && input.indexed),
  )
  if (nonIndexedInputs.length > 0) {
    if (data && data !== '0x') {
      const decoded = decodeAbiParameters(nonIndexedInputs, data)
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i]!
        if ('indexed' in input && input.indexed) continue
        const nonIndexedPosition = nonIndexedInputs.indexOf(input)
        setArg(input, i, (decoded as readonly unknown[])[nonIndexedPosition])
      }
    } else {
      throw new DecodeLogDataMismatch({
        abiItem,
        data: data ?? '0x',
        params: nonIndexedInputs,
        size: data ? size(data) : 0,
      })
    }
  }

  return {
    eventName: abiItem.name,
    args: (Array.isArray(args) ? args.length : Object.keys(args).length)
      ? args
      : undefined,
  }
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
  {
    eventName,
    topic0,
  }: { eventName?: string | undefined; topic0?: Hex | undefined },
): AbiEvent {
  const events = (abi as readonly { type?: string; name?: string }[]).filter(
    (item): item is AbiEvent => item.type === 'event',
  )

  if (eventName) {
    const abiItem = events.find((event) => event.name === eventName)
    if (!abiItem) throw new AbiEventNotFoundError(eventName, { docsPath })
    return abiItem
  }

  if (!topic0) throw new AbiEventSignatureEmptyTopicsError({ docsPath })
  const abiItem = events.find(
    (event) =>
      !event.anonymous && toEventSelector(formatAbiItem(event)) === topic0,
  )
  if (!abiItem) throw new AbiEventSignatureNotFoundError(topic0, { docsPath })
  return abiItem
}

/** Decodes a single indexed topic back to its value (or its hash hex). */
function decodeTopic(param: AbiParameter, topic: Hex): unknown {
  // Dynamic indexed values are only recoverable as their keccak256 hash.
  if (isHashedType(param.type)) return topic
  const [value] = decodeAbiParameters([param], topic)
  return value
}
