import type { Abi, AbiEvent } from 'abitype'
import type { Client } from '../../clients/createClient.js'
import type { RequestErrorType } from '../../clients/transports/http.js'
import {
  DecodeLogDataMismatch,
  DecodeLogTopicsMismatch,
} from '../../errors/abi.js'
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import { TronRpcError, type TronRpcErrorType } from '../../errors/rpc.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Address, AddressInput } from '../../types/address.js'
import type { Hex, LogTopic } from '../../types/misc.js'
import { decodeEventLog } from '../../utils/abi/decodeEventLog.js'
import {
  type EncodeEventTopicsErrorType,
  encodeEventTopics,
} from '../../utils/abi/encodeEventTopics.js'
import {
  type ToBase58ErrorType,
  toBase58,
} from '../../utils/address/toBase58.js'
import { type ToEvmErrorType, toEvm } from '../../utils/address/toEvm.js'
import { hexToBigInt, hexToNumber } from '../../utils/encoding/fromHex.js'
import {
  type NumberToHexErrorType,
  numberToHex,
} from '../../utils/encoding/toHex.js'

/** A block selector tag accepted by the TRON JSON-RPC bridge. */
export type BlockTag = 'latest' | 'earliest' | 'finalized'

/** A raw log entry as returned by the TRON JSON-RPC `eth_getLogs` method. */
type RpcLog = {
  address: Hex
  blockHash: Hex
  blockNumber: Hex
  /** Block timestamp in seconds, hex-encoded (GreatVoyage v4.8.2+). */
  blockTimestamp?: Hex | undefined
  data: Hex
  logIndex: Hex
  removed?: boolean | undefined
  topics?: readonly Hex[] | undefined
  transactionHash: Hex
  transactionIndex: Hex
}

/** A normalized TRON event log. */
export type Log = {
  /** The emitting contract (Base58Check). */
  address: Address
  /** Hash of the block containing the log. */
  blockHash: Hex
  /** Number of the block containing the log. */
  blockNumber: bigint
  /**
   * Block timestamp in SECONDS. Absent on nodes older than GreatVoyage v4.8.2.
   */
  blockTimestamp?: bigint | undefined
  /** ABI-encoded non-indexed parameters. */
  data: Hex
  /** Index of the log within its block. */
  logIndex: number
  /** `true` when the log was removed by a chain reorganization. */
  removed: boolean
  /** The log topics (`topics[0]` is the event selector). */
  topics: readonly Hex[]
  /** Hash of the transaction that emitted the log. */
  transactionHash: Hex
  /** Index of the transaction within its block. */
  transactionIndex: number
  /** The decoded event name, when `event`/`events` was given and decoding succeeded. */
  eventName?: string | undefined
  /**
   * Decoded parameters (keyed by name, or positional for unnamed inputs),
   * normalized to TRON/JS types: `address` → Base58Check, integers → `bigint`.
   * Absent when the log was not (or could not be) decoded.
   */
  args?: Record<string, unknown> | readonly unknown[] | undefined
}

export type GetLogsParameters = {
  /**
   * Restrict to logs emitted by these contract(s) — any accepted address form.
   * Public nodes cap the list at 1000 entries.
   */
  address?: AddressInput | readonly AddressInput[] | undefined
} & (
  | {
      /** The event to filter on (its topics) and decode the logs with. */
      event: AbiEvent
      events?: undefined
      /**
       * Indexed argument filter, positional over the indexed inputs or keyed
       * by name. An array entry is an OR-list of alternatives; `null` /
       * `undefined` leaves that topic as a wildcard.
       */
      args?: readonly unknown[] | Record<string, unknown> | undefined
      /** Drop logs that do not decode against the event ABI. @default false */
      strict?: boolean | undefined
      topics?: undefined
    }
  | {
      event?: undefined
      /** The events to filter on (`topics[0]` OR-list) and decode the logs with. */
      events: readonly AbiEvent[]
      args?: undefined
      /** Drop logs that do not decode against the event ABIs. @default false */
      strict?: boolean | undefined
      topics?: undefined
    }
  | {
      event?: undefined
      events?: undefined
      args?: undefined
      strict?: undefined
      /**
       * Raw topic filter: `topics[n]` matches the log's n-th topic; an array
       * entry is an OR-list (max 1000 alternatives); `null` is a wildcard.
       */
      topics?: readonly LogTopic[] | undefined
    }
) &
  (
    | {
        /** Inclusive lower block bound. @default 'latest' (node default) */
        fromBlock?: bigint | number | BlockTag | undefined
        /** Inclusive upper block bound. @default 'latest' (node default) */
        toBlock?: bigint | number | BlockTag | undefined
        blockHash?: undefined
      }
    | {
        fromBlock?: undefined
        toBlock?: undefined
        /** Restrict to the single block with this hash. */
        blockHash?: Hex | undefined
      }
  )

export type GetLogsReturnType = Log[]

export type GetLogsErrorType =
  | BaseErrorType
  | TronRpcErrorType
  | RequestErrorType
  | EncodeEventTopicsErrorType
  | ToEvmErrorType
  | ToBase58ErrorType
  | NumberToHexErrorType
  | ErrorType

/** The flattened (non-discriminated) view the implementation works against. */
type FlatParameters = {
  address?: AddressInput | readonly AddressInput[] | undefined
  event?: AbiEvent | undefined
  events?: readonly AbiEvent[] | undefined
  args?: readonly unknown[] | Record<string, unknown> | undefined
  strict?: boolean | undefined
  topics?: readonly LogTopic[] | undefined
  fromBlock?: bigint | number | BlockTag | undefined
  toBlock?: bigint | number | BlockTag | undefined
  blockHash?: Hex | undefined
}

/** A TRON JSON-RPC response envelope. */
type JsonRpcResponse = {
  result?: RpcLog[] | null | undefined
  error?:
    | { code?: number | undefined; message?: string | undefined }
    | undefined
}

/** Serializes a block bound: tags pass through, numbers become hex quantities. */
function toBlockRef(block: bigint | number | BlockTag): string {
  return typeof block === 'string' ? block : numberToHex(block)
}

/** Normalizes one raw log (plus its decoded form, when available) to a {@link Log}. */
function formatLog(
  log: RpcLog,
  decoded?: {
    eventName?: string | undefined
    args?: Record<string, unknown> | readonly unknown[] | undefined
  },
): Log {
  return {
    address: toBase58(log.address),
    blockHash: log.blockHash,
    blockNumber: log.blockNumber ? hexToBigInt(log.blockNumber) : 0n,
    ...(log.blockTimestamp
      ? { blockTimestamp: hexToBigInt(log.blockTimestamp) }
      : {}),
    data: log.data ?? '0x',
    logIndex: log.logIndex ? hexToNumber(log.logIndex) : 0,
    removed: log.removed === true,
    topics: log.topics ?? [],
    transactionHash: log.transactionHash,
    transactionIndex: log.transactionIndex
      ? hexToNumber(log.transactionIndex)
      : 0,
    ...(decoded?.eventName
      ? { eventName: decoded.eventName, args: decoded.args }
      : {}),
  }
}

let requestId = 0

/**
 * Reads event logs matching a filter, via the TRON JSON-RPC `eth_getLogs`
 * method (the `/jsonrpc` endpoint of the full node).
 *
 * The filter is either a block range (`fromBlock`/`toBlock` — heights or the
 * `'latest'` / `'earliest'` / `'finalized'` tags; both default to `'latest'`
 * on the node) or a single block by `blockHash`. Topics can be filtered three
 * ways: an ABI `event` (optionally narrowed by indexed `args`), a list of
 * `events` (matched by selector), or a raw `topics` array. When `event` /
 * `events` is given each log is decoded — `eventName` and `args` are populated,
 * with addresses rendered as Base58Check and integers as `bigint`. A log that
 * does not decode against the ABI is returned raw, or dropped when
 * `strict: true`.
 *
 * Protocol note: nodes cap the queried block span (5000 by default, via
 * `node.jsonrpc.maxBlockRange`) and the `address` / topic OR-list sizes
 * (1000 each) — an exceeded limit rejects with a {@link TronRpcError}.
 *
 * `eth_getLogs` has no transaction-hash filter dimension: to read the events
 * of one known transaction, use {@link getTransactionInfo} — its `logs` carry
 * the receipt's raw entries, decodable via `decodeEventLog`.
 *
 * @see https://developers.tron.network/reference/eth_getlogs
 *
 * @param client The Client to use.
 * @param parameters The log filter: `address` / `event`(`s`) / `args` /
 *   `topics` plus a `fromBlock`/`toBlock` range or a `blockHash`.
 * @returns The matching logs, decoded where possible.
 *
 * @example
 * const logs = await getLogs(client, {
 *   address: 'T...',
 *   event: {
 *     type: 'event',
 *     name: 'Transfer',
 *     inputs: [
 *       { indexed: true, name: 'from', type: 'address' },
 *       { indexed: true, name: 'to', type: 'address' },
 *       { indexed: false, name: 'value', type: 'uint256' },
 *     ],
 *   },
 *   args: { to: 'T...' },
 *   fromBlock: 65_579_000n,
 *   toBlock: 'latest',
 * })
 */
export async function getLogs(
  client: Client,
  parameters: GetLogsParameters = {},
): Promise<GetLogsReturnType> {
  const {
    address,
    args,
    blockHash,
    event,
    events: events_,
    fromBlock,
    strict = false,
    toBlock,
  } = parameters as FlatParameters

  if (blockHash && (fromBlock !== undefined || toBlock !== undefined))
    throw new BaseError(
      '`blockHash` cannot be used together with `fromBlock` / `toBlock`.',
    )

  const events = events_ ?? (event ? [event] : undefined)
  let topics = (parameters as FlatParameters).topics ?? []
  if (events) {
    const encoded = events.flatMap((abiEvent) =>
      encodeEventTopics({
        abi: [abiEvent],
        eventName: abiEvent.name,
        // A plural `events` filter matches by selector only — args would be
        // ambiguous across the list.
        args: events_ ? undefined : args,
      }),
    )
    topics = event ? encoded : [encoded as LogTopic]
  }

  const filter: Record<string, unknown> = {
    ...(address !== undefined
      ? {
          address: Array.isArray(address)
            ? address.map((address) => toEvm(address))
            : toEvm(address as AddressInput),
        }
      : {}),
    ...(topics.length > 0 ? { topics } : {}),
    ...(fromBlock !== undefined ? { fromBlock: toBlockRef(fromBlock) } : {}),
    ...(toBlock !== undefined ? { toBlock: toBlockRef(toBlock) } : {}),
    ...(blockHash ? { blockHash } : {}),
  }

  const response = await client.request<JsonRpcResponse>({
    path: '/jsonrpc',
    method: 'POST',
    body: {
      jsonrpc: '2.0',
      id: ++requestId,
      method: 'eth_getLogs',
      params: [filter],
    },
  })
  if (response.error)
    throw new TronRpcError(
      response.error.message ?? 'The eth_getLogs request was rejected.',
      {
        metaMessages:
          response.error.code !== undefined
            ? [`Code: ${response.error.code}`]
            : undefined,
      },
    )

  const logs: Log[] = []
  for (const log of response.result ?? []) {
    if (!events) {
      logs.push(formatLog(log))
      continue
    }
    try {
      const decoded = decodeEventLog({
        abi: events as unknown as Abi,
        data: log.data,
        topics: (log.topics ?? []) as readonly Hex[],
      })
      logs.push(formatLog(log, decoded))
    } catch (err) {
      // A log that does not decode against the ABI (mismatched `data` /
      // `topics`) is kept raw — or dropped entirely in strict mode.
      if (
        err instanceof DecodeLogDataMismatch ||
        err instanceof DecodeLogTopicsMismatch
      ) {
        if (strict) continue
        logs.push(formatLog(log, { eventName: err.abiItem.name }))
        continue
      }
      // e.g. a selector outside the provided ABI — keep the raw log.
      logs.push(formatLog(log))
    }
  }
  return logs
}
