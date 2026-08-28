import type { Abi, AbiEvent, AbiParameter } from 'abitype'

import {
  AbiDecodingDataSizeTooSmallError,
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
import { PositionOutOfBoundsError } from '../../errors/cursor.js'
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
import { formatAbiItem, formatAbiParams } from './formatAbiItem.js'

export type DecodeEventLogParameters = {
  /** ABI containing the event definition. */
  abi: Abi | readonly unknown[]
  /** Ordered log topics (`topics[0]` is the selector for non-anonymous events). */
  topics: readonly Hex[]
  /** Non-indexed event data. */
  data?: Hex | undefined
  /** Event name (required to decode `anonymous` events). */
  eventName?: string | undefined
  /**
   * Whether decoding must be exact. When `false`, an indexed parameter with no
   * topic is recovered from `data` instead, extra topics are ignored, and
   * `data` that fails to decode is skipped — the decodable subset of `args`
   * is still returned.
   * @default true
   */
  strict?: boolean | undefined
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
 * By default a log that does not match the event exactly throws
 * ({@link DecodeLogTopicsMismatch} / {@link DecodeLogDataMismatch}) — a
 * missing topic for an indexed parameter and a log carrying more topics than
 * the event has indexed parameters both count as mismatches. With
 * `strict: false` the mismatch is tolerated instead: an indexed parameter with
 * no topic is recovered from `data`, extra topics are ignored, undecodable
 * `data` is skipped, and the decodable subset of `args` is returned.
 *
 * @example
 * decodeEventLog({ abi, topics, data })
 * // { eventName: 'Transfer', args: { from: 'T…', to: 'T…', value: 1000000n } }
 */
export function decodeEventLog(
  parameters: DecodeEventLogParameters,
): DecodeEventLogReturnType {
  const { abi, topics, data, eventName, strict = true } = parameters
  const [topic0, ...argTopics_] = topics

  const abiItem = selectEvent(abi, { eventName, topic0 })
  const inputs = (abiItem.inputs ?? []) as readonly AbiParameter[]

  // Anonymous events carry no selector, so every topic is an argument topic.
  const argTopics = abiItem.anonymous ? topics : argTopics_

  // A log carrying MORE topics than the event has indexed parameters is not a
  // log of this event — reject it instead of silently dropping the extras.
  const indexedCount = inputs.filter(
    (input) => 'indexed' in input && input.indexed,
  ).length
  if (strict && argTopics.length > indexedCount)
    throw new DecodeLogTopicsMismatch({
      abiItem,
      expectedTopics: indexedCount,
      formattedAbiItem: formatAbiItem(abiItem, { includeName: true }),
      receivedTopics: argTopics.length,
    })

  const isUnnamed = inputs.some((input) => !input.name)
  const args: Record<string, unknown> | unknown[] = isUnnamed ? [] : {}
  const setArg = (input: AbiParameter, index: number, value: unknown) => {
    if (isUnnamed) (args as unknown[])[index] = value
    else (args as Record<string, unknown>)[input.name!] = value
  }

  // Indexed parameters come from the topics, in declaration order.
  const missingIndexed: (readonly [AbiParameter, number])[] = []
  let topicIndex = 0
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]!
    if (!('indexed' in input && input.indexed)) continue
    const topic = argTopics[topicIndex]
    topicIndex++
    if (topic === undefined) {
      if (strict)
        throw new DecodeLogTopicsMismatch({
          abiItem,
          formattedAbiItem: formatAbiItem(abiItem, { includeName: true }),
          param: input as AbiParameter & { indexed: boolean },
        })
      // The emitting contract may not have actually indexed this parameter —
      // recover its value from `data` below.
      missingIndexed.push([input, i])
      continue
    }
    setArg(input, i, decodeTopic(input, topic))
  }

  // Non-indexed parameters come from `data`, joined — in lenient mode — by
  // the indexed parameters whose topics were missing. An emitter that did not
  // actually index them laid their values out in `data` at their DECLARATION
  // positions, so the merge must preserve declaration order.
  const missingIndexedAt = new Set(missingIndexed.map(([, i]) => i))
  const inputsToDecode: (readonly [AbiParameter, number])[] = []
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]!
    if ('indexed' in input && input.indexed && !missingIndexedAt.has(i))
      continue
    inputsToDecode.push([input, i])
  }
  const paramsToDecode = inputsToDecode.map(([input]) => input)
  if (inputsToDecode.length > 0) {
    if (data && data !== '0x') {
      try {
        const decoded = decodeAbiParameters(
          paramsToDecode,
          data,
        ) as readonly unknown[]
        // Consume the decoded values in order, like `topicIndex` above. An
        // identity lookup (`paramsToDecode.indexOf(input)`) would resolve
        // every occurrence of a reused parameter object to its first slot.
        let dataIndex = 0
        for (const [input, i] of inputsToDecode)
          setArg(input, i, decoded[dataIndex++])
      } catch (err) {
        if (strict) {
          if (
            err instanceof AbiDecodingDataSizeTooSmallError ||
            err instanceof PositionOutOfBoundsError
          )
            throw new DecodeLogDataMismatch({
              abiItem,
              data,
              formattedParams: formatAbiParams(paramsToDecode, {
                includeName: true,
              }),
              params: paramsToDecode,
              size: size(data),
            })
          throw err
        }
        // Lenient mode keeps whatever the topics yielded.
      }
    } else if (strict) {
      throw new DecodeLogDataMismatch({
        abiItem,
        data: data ?? '0x',
        formattedParams: formatAbiParams(paramsToDecode, {
          includeName: true,
        }),
        params: paramsToDecode,
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
    const named = events.filter((event) => event.name === eventName)
    if (named.length === 0)
      throw new AbiEventNotFoundError(eventName, { docsPath })
    // A non-anonymous log's topic0 IS the event's identity — validate it (and
    // disambiguate overloads) instead of matching by the name label alone.
    if (topic0) {
      const matched = named.find(
        (event) =>
          !event.anonymous && toEventSelector(formatAbiItem(event)) === topic0,
      )
      if (matched) return matched
      // All-anonymous candidates: topic0 is the first indexed arg, not a
      // selector — the name match is all there is to go on.
      if (named.every((event) => event.anonymous)) return named[0]!
      throw new AbiEventSignatureNotFoundError(topic0, { docsPath })
    }
    return named[0]!
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
