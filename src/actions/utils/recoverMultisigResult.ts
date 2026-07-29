// TRON-specific, clean-room implementation for @tronweb3/tviem.
import { TronNodeError } from '../../errors/node.js'

/**
 * Recovers a multi-sig weight/approval body from an over-eager transport error.
 *
 * The generic response normalizer rejects any `{ result: { code, message } }`
 * body as a contract-validate error, but `getSignWeight` / `getApprovedList`
 * legitimately report progress through `result.code` (e.g.
 * `NOT_ENOUGH_PERMISSION` while signatures are still being collected). When the
 * mis-classified error still carries a body that echoes the transaction /
 * permission / approval data, that body is the real response and is returned
 * here; a genuine node error (no such body) yields `undefined` so the caller
 * can rethrow.
 *
 * @param error The error thrown by the transport.
 * @returns The recovered response body, or `undefined` to rethrow.
 */
export function recoverEchoedResultBody(
  error: unknown,
): Record<string, unknown> | undefined {
  if (!(error instanceof TronNodeError)) return undefined
  const body = error.response
  if (!body || typeof body !== 'object') return undefined
  const b = body as Record<string, unknown>
  if (
    'transaction' in b ||
    'permission' in b ||
    'approved_list' in b ||
    'current_weight' in b
  )
    return b
  return undefined
}
