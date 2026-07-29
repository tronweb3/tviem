// TRON-specific, clean-room implementation for @tronweb3/tviem.
import { TronRpcError } from '../../errors/rpc.js'

/**
 * Asserts that a node response does not carry a logical failure.
 *
 * The transport's `normalizeTronError` already throws for the four documented
 * error-body shapes, but some endpoints report success/failure through a
 * nested `result` object that a normal business object would not
 * (`triggerconstantcontract`'s `{ result: { result: false } }`,
 * `broadcasttransaction`'s `{ result: false }`). This is the shared guard for
 * those cases; endpoint actions may re-inspect the body for a richer message
 * (e.g. `readContract` decoding a revert reason from `constant_result`).
 *
 * @param response The (already error-normalized) node response body.
 * @param options `path` — endpoint path, added to the error's meta messages.
 */
export function assertRpcSuccess(
  response: unknown,
  { path }: { path?: string | undefined } = {},
): void {
  if (!response || typeof response !== 'object') return
  const body = response as Record<string, unknown>
  const result = body.result

  // Nested-result failure (e.g. constant contract call reverted).
  if (
    result &&
    typeof result === 'object' &&
    (result as Record<string, unknown>).result === false
  ) {
    const inner = result as Record<string, unknown>
    throw new TronRpcError('The node reported the call was unsuccessful.', {
      details: typeof inner.message === 'string' ? inner.message : undefined,
      metaMessages: [
        inner.code ? `Code: ${String(inner.code)}` : undefined,
        path ? `Path: ${path}` : undefined,
      ].filter((m): m is string => Boolean(m)),
    })
  }

  // Top-level rejection (e.g. broadcast refused).
  if (result === false) {
    throw new TronRpcError('The node rejected the request.', {
      details: typeof body.message === 'string' ? body.message : undefined,
      metaMessages: [
        body.code ? `Code: ${String(body.code)}` : undefined,
        path ? `Path: ${path}` : undefined,
      ].filter((m): m is string => Boolean(m)),
    })
  }
}
