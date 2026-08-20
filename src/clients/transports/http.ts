import {
  TronBroadcastError,
  type TronBroadcastErrorType,
  TronContractValidateError,
  type TronContractValidateErrorType,
  TronNodeError,
  type TronNodeErrorType,
  TronValidationError,
  type TronValidationErrorType,
  type UnknownNodeErrorType,
} from '../../errors/node.js'
import {
  HttpRequestError,
  type HttpRequestErrorType,
  TimeoutError,
  type TimeoutErrorType,
} from '../../errors/request.js'
import { UrlRequiredError } from '../../errors/transport.js'
import { type ErrorType, isAbortError } from '../../errors/utils.js'
import type { Hex } from '../../types/misc.js'
import type { TronNode, TronRequestArgs } from '../../types/transport.js'
import { hexToString } from '../../utils/encoding/fromHex.js'
import { stringify } from '../../utils/stringify.js'
import {
  createTransport,
  type Transport,
  type TransportConfig,
} from './createTransport.js'

export type HttpTransportConfig = {
  /** API key sent as the `TRON-PRO-API-KEY` request header. */
  apiKey?: string | undefined
  /** Custom `fetch` implementation (primarily for testing). */
  fetchFn?: typeof fetch | undefined
  /** Extra request options passed to `fetch` (merged; headers are extended). */
  fetchOptions?: Omit<RequestInit, 'body' | 'method' | 'signal'> | undefined
  /** The key of the HTTP transport. */
  key?: TransportConfig['key'] | undefined
  /** The name of the HTTP transport. */
  name?: TransportConfig['name'] | undefined
  /**
   * Event index (TronGrid `/v1/*`) base URL. Defaults to the chain's `event`
   * host, else `url` (public TronGrid hosts serve `/wallet` and `/v1` alike).
   */
  eventUrl?: string | undefined
  /** Return the raw node body without error normalization. */
  raw?: boolean | undefined
  /** The max number of times to retry. */
  retryCount?: TransportConfig['retryCount'] | undefined
  /** The base delay (in ms) between retries. */
  retryDelay?: TransportConfig['retryDelay'] | undefined
  /** SolidityNode base URL. Defaults to the chain's solidity host, else `url`. */
  solidityUrl?: string | undefined
  /** The timeout (in ms) for the HTTP request. @default 10_000 */
  timeout?: TransportConfig['timeout'] | undefined
}

export type HttpTransport = Transport<
  'http',
  {
    fullUrl: string
    solidityUrl: string
    eventUrl: string
    fetchOptions?: HttpTransportConfig['fetchOptions'] | undefined
  }
>

/** Resolves a request's absolute URL from a node base, role and path. */
function resolveUrl(base: string, node: TronNode, path: string): string {
  const b = base.replace(/\/+$/, '')
  // A leading `/` is a host-root absolute escape (e.g. `/jsonrpc`, `/v1/*`).
  if (path.startsWith('/')) return `${b}${path}`
  const prefix = node === 'solidity' ? '/walletsolidity/' : '/wallet/'
  return `${b}${prefix}${path}`
}

/** Whether `JSON.parse` exposes the raw source text to its reviver (V8). */
const supportsParseSource = (() => {
  try {
    let seen = false
    JSON.parse('0', ((_key, value, context?: { source?: string }) => {
      seen = typeof context?.source === 'string'
      return value
    }) as (key: string, value: unknown) => unknown)
    return seen
  } catch {
    return false
  }
})()

/**
 * Parses node-rendered JSON (a response body, or a JSON string nested inside
 * one, e.g. a `broadcasthex` acknowledgement's `transaction` field).
 * java-tron renders `int64` fields (balances, amounts) as bare JSON numbers,
 * which a naive `JSON.parse` corrupts past `2^53 - 1` BEFORE any
 * `BigInt(...)` coercion can save them — so, where the engine exposes the
 * raw literal to the reviver, an unsafe integer literal is re-materialized
 * losslessly as a `bigint`. On engines without reviver source access this
 * falls back to a plain parse (actions guard the affected fields).
 */
export function parseNodeJson(text: string): unknown {
  if (!supportsParseSource) return JSON.parse(text)
  return JSON.parse(text, ((_key, value, context?: { source?: string }) => {
    if (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      !Number.isSafeInteger(value) &&
      context?.source &&
      /^-?\d+$/.test(context.source)
    )
      return BigInt(context.source)
    return value
  }) as (key: string, value: unknown) => unknown)
}

/** TRON node message fields are hex-encoded; decode to UTF-8 (or pass through). */
export function decodeNodeMessage(message: unknown): string {
  if (typeof message !== 'string' || message.length === 0) return ''
  const hex = message.startsWith('0x') ? message : `0x${message}`
  if (/^0x[0-9a-fA-F]*$/.test(hex) && (hex.length - 2) % 2 === 0) {
    try {
      return hexToString(hex as Hex)
    } catch {}
  }
  return message
}

function isSuccessCode(code: unknown): boolean {
  return code === 'SUCCESS' || code === 0 || code === '0' || code === 200
}

/**
 * Everything a `client.request` round-trip can throw: the HTTP layer
 * (network failure, timeout) plus the four documented TRON node error
 * shapes surfaced by {@link normalizeTronError}. The building block for
 * per-action `XxxErrorType` unions.
 */
export type RequestErrorType =
  | HttpRequestErrorType
  | TimeoutErrorType
  | TronBroadcastErrorType
  | TronContractValidateErrorType
  | TronNodeErrorType
  | TronValidationErrorType
  // buildRequest wraps any non-BaseError thrown inside the transport
  // (circular request body, a custom fetchFn throwing a non-Error, …).
  | UnknownNodeErrorType
  | ErrorType

/**
 * Normalizes a TRON node response body (usually delivered over HTTP 200).
 *
 * Detects the four documented error shapes and throws the matching error;
 * a `{ result: true }` / `{ result: { result: true } }` / normal business
 * object is returned unchanged. Called at the transport's `config.request`
 * layer (skipped in `raw` mode).
 */
export function normalizeTronError(
  body: unknown,
  { node, path }: { node: TronNode; path: string },
): unknown {
  if (!body || typeof body !== 'object') return body
  const b = body as Record<string, any>

  // Form 1: { Error: string } — plaintext validation error.
  if (typeof b.Error === 'string')
    throw new TronValidationError(b.Error, { node, path, response: body })

  // Form 2: { result: { code, message } } — contract validate rejection.
  if (
    b.result &&
    typeof b.result === 'object' &&
    b.result.code &&
    b.result.message
  )
    throw new TronContractValidateError(decodeNodeMessage(b.result.message), {
      code: String(b.result.code),
      node,
      path,
      response: body,
    })

  // Form 3: { result: false, code } — broadcast rejection.
  if (b.result === false && b.code)
    throw new TronBroadcastError(decodeNodeMessage(b.message), {
      code: String(b.code),
      txid: typeof b.txid === 'string' ? b.txid : undefined,
      node,
      path,
      response: body,
    })

  // Form 4: top-level { code } that is not a success code.
  if (b.code && !isSuccessCode(b.code))
    throw new TronNodeError(decodeNodeMessage(b.message), {
      code: String(b.code),
      node,
      path,
      response: body,
    })

  // Success / normal business object.
  return body
}

/**
 * Creates an HTTP transport that connects to a TRON node's REST API.
 *
 * @param url FullNode base URL. Defaults to the chain's `full` RPC URL.
 */
export function http(
  url?: string | undefined,
  config: HttpTransportConfig = {},
): HttpTransport {
  const {
    apiKey,
    fetchFn,
    fetchOptions,
    key = 'http',
    name = 'HTTP REST',
    raw,
    retryDelay,
  } = config
  return ({ chain, retryCount: retryCount_, timeout: timeout_ }) => {
    const retryCount = config.retryCount ?? retryCount_
    const timeout = timeout_ ?? config.timeout ?? 10_000
    const fullUrl = url || chain?.rpcUrls.default.full.http[0]
    if (!fullUrl) throw new UrlRequiredError()
    const solidityUrl =
      config.solidityUrl || chain?.rpcUrls.default.solidity.http[0] || fullUrl
    const eventUrl =
      config.eventUrl || chain?.rpcUrls.default.event?.http[0] || fullUrl

    // Merge through the platform's `Headers` rather than object spread: all
    // three legal `HeadersInit` forms survive (a spread silently turns a
    // `Headers` instance into `{}` and a tuple list into a header named "0"),
    // and names are matched case-insensitively as HTTP requires — a caller's
    // lowercase `content-type` or `tron-pro-api-key` replaces the default
    // instead of riding alongside it as a duplicate.
    const headers = new Headers(fetchOptions?.headers)
    // The caller's explicit Content-Type wins; JSON is only the default.
    if (!headers.has('Content-Type'))
      headers.set('Content-Type', 'application/json')
    // The config `apiKey` is the documented channel and wins over any header
    // spelling of the same key, so exactly one key is ever sent.
    if (apiKey) headers.set('TRON-PRO-API-KEY', apiKey)
    const mergedFetchOptions = { ...fetchOptions, headers }

    return createTransport(
      {
        key,
        name,
        async request(args: TronRequestArgs, options) {
          const node: TronNode = args.node ?? 'full'
          const method = args.method ?? 'POST'
          const base =
            node === 'solidity'
              ? solidityUrl
              : node === 'event'
                ? eventUrl
                : fullUrl
          const requestUrl = resolveUrl(base, node, args.path)
          const requestBody =
            method === 'POST' ? stringify(args.body ?? {}) : undefined

          const controller = new AbortController()
          const externalSignal = options?.signal
          const onExternalAbort = () => controller.abort()
          if (externalSignal) {
            if (externalSignal.aborted) controller.abort()
            else
              externalSignal.addEventListener('abort', onExternalAbort, {
                once: true,
              })
          }
          const timer = setTimeout(() => controller.abort(), timeout)

          const fetchImpl = fetchFn ?? globalThis.fetch

          /** Whether this failure is our own abort rather than a network fault. */
          function isAbortSignalled(err: unknown): boolean {
            return controller.signal.aborted || isAbortError(err)
          }

          /**
           * Maps an abort to the error that says WHO aborted: the caller's own
           * signal propagates as-is, while our timer becomes a `TimeoutError`.
           */
          function abortAware(err: unknown): Error {
            if (controller.signal.aborted && !externalSignal?.aborted)
              return new TimeoutError({
                body: (args.body ?? {}) as Record<string, unknown>,
                url: requestUrl,
              })
            if (isAbortError(err)) return err as Error
            return new HttpRequestError({
              body: args.body as Record<string, unknown> | undefined,
              cause: err as Error,
              url: requestUrl,
            })
          }

          /**
           * `fetch` resolves as soon as the response HEADERS arrive; the body
           * can still be streaming, or never finish. The timer and the caller's
           * abort listener therefore have to outlive the fetch and stay armed
           * until the body has been consumed — tearing them down at the fetch
           * boundary would leave a trickling or half-open response able to hang
           * the call forever, with the configured `timeout` and the caller's
           * `AbortSignal` both already disconnected.
           */
          try {
            let response: Response
            try {
              response = await fetchImpl(requestUrl, {
                ...mergedFetchOptions,
                method,
                ...(requestBody !== undefined ? { body: requestBody } : {}),
                signal: controller.signal,
              })
            } catch (err) {
              throw abortAware(err)
            }

            if (!response.ok) {
              // Reading the error body is itself covered by the timeout: an
              // error response can stall exactly like a successful one.
              let details: string | undefined
              try {
                details = await response.text()
              } catch (err) {
                // A stalled error body must surface as the timeout/abort it is,
                // not as a status-only error that hides why nothing came back.
                if (isAbortSignalled(err)) throw abortAware(err)
              }
              throw new HttpRequestError({
                body: args.body as Record<string, unknown> | undefined,
                details,
                headers: response.headers,
                status: response.status,
                url: requestUrl,
              })
            }

            let body: any
            try {
              const text = await response.text()
              body = text ? parseNodeJson(text) : {}
            } catch (err) {
              // Same classification as the fetch phase. Without this an abort
              // during the body read would be reported as an `HttpRequestError`
              // carrying `status: 200` — a "successful" response that never
              // arrived, which no retry predicate can read correctly.
              if (isAbortSignalled(err)) throw abortAware(err)
              throw new HttpRequestError({
                body: args.body as Record<string, unknown> | undefined,
                cause: err as Error,
                headers: response.headers,
                status: response.status,
                url: requestUrl,
              })
            }

            if (raw) return body
            return normalizeTronError(body, { node, path: args.path })
          } finally {
            clearTimeout(timer)
            externalSignal?.removeEventListener('abort', onExternalAbort)
          }
        },
        retryCount,
        retryDelay,
        timeout,
        type: 'http',
      },
      {
        fetchOptions: mergedFetchOptions,
        fullUrl,
        solidityUrl,
        eventUrl,
      },
    )
  }
}
