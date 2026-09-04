import { getAbortError } from '../../errors/utils.js'
import { LruMap } from '../lru.js'

/** @internal */
export const promiseCache = /*#__PURE__*/ new LruMap<Promise<any>>(8192)

type WithDedupeOptions = {
  enabled?: boolean | undefined
  id?: string | undefined
  /**
   * The caller's abort signal. Aborting detaches only this caller from the
   * shared promise — other callers and the underlying request are unaffected.
   */
  signal?: AbortSignal | undefined
}

/** Deduplicates concurrent in-flight promises that share the same `id`. */
export function withDedupe<data>(
  fn: () => Promise<data>,
  { enabled = true, id, signal }: WithDedupeOptions,
): Promise<data> {
  if (!enabled || !id) return fn()
  if (signal?.aborted) return Promise.reject(getAbortError(signal))

  let shared = promiseCache.get(id) as Promise<data> | undefined
  if (!shared) {
    shared = fn().finally(() => promiseCache.delete(id))
    promiseCache.set(id, shared)
  }
  if (!signal) return shared

  // Each waiter races its own signal against the shared promise: aborting
  // rejects only this waiter's promise, while the shared request keeps
  // running for the others (and stays handled, so no unhandled rejection).
  return new Promise<data>((resolve, reject) => {
    const onAbort = () => reject(getAbortError(signal))
    signal.addEventListener('abort', onAbort, { once: true })
    shared.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}
