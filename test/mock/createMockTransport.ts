/**
 * In-memory mock transport for offline client / action tests.
 *
 * Replaces only the innermost `config.request` (through the real
 * `createTransport`), so `buildRequest` (retry / dedupe) and the TRON
 * error-body normalization run on the genuine code path: every scripted reply
 * is passed through `normalizeTronError` exactly as a real HTTP body would be.
 * Because TRON returns logical errors as HTTP-200 bodies, an `{ error }` reply
 * is *resolved* (not rejected) and normalization turns it into the matching
 * `Tron*Error` — no HTTP status simulation is needed.
 *
 * Replies are matched by request `path`. A single reply is served on every
 * matching call; an array reply is a polling queue advanced one step per call
 * with its final entry sticky (drives `waitForTransactionReceipt` tests). Each
 * received request is recorded as a frozen snapshot for assertion.
 */
import {
  createTransport,
  type Transport,
} from '../../src/clients/transports/createTransport.js'
import { normalizeTronError } from '../../src/clients/transports/http.js'
import { BaseError } from '../../src/errors/base.js'
import type {
  TronNode,
  TronRequestArgs,
  TronRequestFn,
} from '../../src/types/transport.js'

/** A single scripted reply for a matched request. */
export type MockResponse =
  | { response: unknown }
  | { error: unknown }
  | { fn: (args: TronRequestArgs) => unknown }

/**
 * Maps an endpoint `path` to its scripted reply. An array value is a polling
 * queue: advanced one step per matching call, its last entry sticky.
 */
export type MockResponses = Record<string, MockResponse | MockResponse[]>

/** A frozen record of one request the mock received. */
export type MockCall = {
  /** Resolved node role (`args.node ?? 'full'`). */
  readonly node: TronNode
  /** Endpoint path the request targeted. */
  readonly path: string
  /** Resolved HTTP verb (`args.method ?? 'POST'`). */
  readonly method: 'GET' | 'POST'
  /** The request body as supplied by the caller. */
  readonly body: unknown
}

export type CreateMockTransportParameters = {
  /** Scripted replies keyed by request `path`. */
  responses: MockResponses
  /**
   * Behavior when no `responses` entry matches a request `path`:
   * `'throw'` (default) rejects with a descriptive `BaseError`; a `MockResponse`
   * acts as a catch-all default reply.
   */
  onUnmatched?: 'throw' | MockResponse | undefined
  /**
   * Retry count for the underlying transport. Defaults to `0` so a polling
   * queue advances exactly once per logical request.
   */
  retryCount?: number | undefined
}

export type MockTransport = {
  /** A `Transport` factory usable as `createPublicClient({ transport })`. */
  transport: Transport<'mock'>
  /** Frozen, in-order snapshots of every received request. */
  calls: readonly MockCall[]
  /** The `body` of the `i`-th (default `0`) recorded call to `path`. */
  bodyOf: (path: string, i?: number) => unknown
  /** Clears recorded calls and rewinds every polling queue. */
  reset: () => void
}

/** Resolves a scripted reply to the raw body normalization will run on. */
function bodyOfEntry(entry: MockResponse, args: TronRequestArgs): unknown {
  if ('error' in entry) return entry.error
  if ('fn' in entry) return entry.fn(args)
  return entry.response
}

/**
 * Creates a mock transport plus its recording helpers.
 *
 * @param parameters Scripted `responses` and optional `onUnmatched` policy.
 * @returns `{ transport, calls, bodyOf, reset }`.
 */
export function createMockTransport({
  responses,
  onUnmatched = 'throw',
  retryCount = 0,
}: CreateMockTransportParameters): MockTransport {
  const calls: MockCall[] = []
  const cursors = new Map<string, number>()

  const request = (async (args: TronRequestArgs): Promise<unknown> => {
    const node: TronNode = args.node ?? 'full'
    const method = args.method ?? 'POST'
    calls.push(
      Object.freeze({ node, path: args.path, method, body: args.body }),
    )

    let entry = responses[args.path]
    if (entry === undefined) {
      if (onUnmatched === 'throw')
        throw new BaseError(`No mock response for "${node}/${args.path}".`, {
          metaMessages: [
            `Known paths: ${Object.keys(responses).join(', ') || '(none)'}`,
          ],
          name: 'MockTransportError',
        })
      entry = onUnmatched
    }

    let selected: MockResponse
    if (Array.isArray(entry)) {
      if (entry.length === 0)
        throw new BaseError(`Empty mock queue for "${node}/${args.path}".`, {
          name: 'MockTransportError',
        })
      const i = cursors.get(args.path) ?? 0
      selected = entry[Math.min(i, entry.length - 1)] as MockResponse
      cursors.set(args.path, i + 1)
    } else {
      selected = entry
    }

    const body = bodyOfEntry(selected, args)
    // Mirror http.ts: every body is normalized. Error bodies throw the matching
    // Tron*Error; success bodies pass through unchanged.
    return normalizeTronError(body, { node, path: args.path })
  }) as TronRequestFn

  const transport: Transport<'mock'> = () =>
    createTransport<'mock', Record<string, never>>({
      key: 'mock',
      name: 'Mock Transport',
      request,
      retryCount,
      retryDelay: 0,
      type: 'mock',
    })

  return {
    transport,
    calls,
    bodyOf(path, i = 0) {
      return calls.filter((call) => call.path === path)[i]?.body
    },
    reset() {
      calls.length = 0
      cursors.clear()
    },
  }
}
