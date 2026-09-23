import { BaseError } from '../errors/base.js'
import { TronNodeError, UnknownNodeError } from '../errors/node.js'
import { HttpRequestError } from '../errors/request.js'
import { getAbortError, isAbortError } from '../errors/utils.js'
import type { TronRequestFn, TronRequestOptions } from '../types/transport.js'
import { withDedupe } from './promise/withDedupe.js'
import { withRetry } from './promise/withRetry.js'
import { stringify } from './stringify.js'

/**
 * Wraps a raw transport `request` (the innermost `config.request`) with retry,
 * exponential backoff, in-flight de-duplication and error passthrough.
 *
 * TRON error-body normalization happens inside `config.request` (see
 * `http.ts` `normalizeTronError`), so by the time an error reaches here it is
 * already a {@link BaseError}. Anything else is a genuinely unexpected throw
 * and is wrapped as an {@link UnknownNodeError}.
 */
export function buildRequest<
  request extends (
    args: any,
    options?: { signal?: AbortSignal | undefined } | undefined,
  ) => Promise<any>,
>(request: request, options: TronRequestOptions = {}): TronRequestFn {
  return async (args, overrideOptions = {}) => {
    const {
      dedupe = false,
      retryDelay = 150,
      retryCount = 0,
      signal,
      uid,
    } = {
      ...options,
      ...overrideOptions,
    }

    if (signal?.aborted) throw getAbortError(signal)

    const requestId = dedupe
      ? hashString(`${uid}.${stringify(args)}`)
      : undefined

    // A deduplicated request is shared by every concurrent caller, so it must
    // not be tied to any single caller's signal: each caller instead races its
    // own signal against the shared promise inside `withDedupe`.
    const sharedSignal = requestId ? undefined : signal

    return withDedupe(
      () =>
        withRetry(
          async () => {
            try {
              return await request(
                args,
                sharedSignal ? { signal: sharedSignal } : undefined,
              )
            } catch (err_) {
              if (sharedSignal?.aborted) throw getAbortError(sharedSignal)
              if (isAbortError(err_)) throw err_
              // Errors are already normalized at the `config.request` layer.
              if (err_ instanceof BaseError) throw err_
              throw new UnknownNodeError({ cause: err_ as Error })
            }
          },
          {
            delay: ({ count }) => ~~(1 << count) * retryDelay,
            retryCount,
            signal: sharedSignal,
            shouldRetry: ({ error }) => shouldRetryTron(error),
          },
        ),
      { enabled: dedupe, id: requestId, signal },
    )
  }
}

/**
 * Retry predicate for TRON transports.
 *
 * Retries transient conditions (network / timeout / rate-limit / server
 * errors) and never retries a definitive TRON logical error
 * (validate / signature / balance / broadcast rejection).
 */
export function shouldRetryTron(error: Error) {
  if (isAbortError(error)) return false
  // Definitive node-side logical errors are deterministic — do not retry.
  if (error instanceof TronNodeError) return false
  if (error instanceof HttpRequestError && error.status) {
    // Forbidden
    if (error.status === 403) return true
    // Request Timeout
    if (error.status === 408) return true
    // Request Entity Too Large
    if (error.status === 413) return true
    // Too Many Requests
    if (error.status === 429) return true
    // Server errors
    if (error.status >= 500 && error.status <= 599) return true
    return false
  }
  // Network failures / timeouts / unknown → retry.
  return true
}

/** @internal cyrb53 – fast, non-cryptographic 53-bit string hash */
function hashString(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 16), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 16), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}
