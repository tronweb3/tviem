import { TronNodeError } from '../../errors/node.js'

/**
 * Recovers a multi-sig weight / approval body from an over-eager transport
 * error.
 *
 * The generic response normalizer rejects any `{ result: { code, message } }`
 * body as a contract-validate error, but `getsignweight` / `getapprovedlist`
 * report their verdict through `result.code` (`NOT_ENOUGH_PERMISSION` while
 * signatures are still being collected, `SUCCESS` for an approval list). A
 * real java-tron node never pairs a verdict code with a `message`, so the
 * normalizer never fires on one; this guards the proxy or mock that does.
 *
 * The verdict is read from `result.code` ALONE. The echoed transaction /
 * permission / weight fields say nothing about it: java-tron sets the
 * transaction echo before its try block, so every failure branch
 * (`SIGNATURE_FORMAT_ERROR`, `COMPUTE_ADDRESS_ERROR`, `PERMISSION_ERROR`,
 * `OTHER_ERROR`) still echoes it — and those are exactly the branches that
 * carry a `message`. Recovering on the echo turned every genuine failure into
 * `{ currentWeight: 0n, approvedList: [] }`: a co-signer signing under the
 * wrong `Permission_id` read as "nobody has signed yet" to a UI polling for
 * weight.
 *
 * @param error The error thrown by the transport.
 * @param options `okCodes` — the endpoint's verdict codes. Any other code is a
 *   failure and yields `undefined` so the caller rethrows.
 * @returns The recovered response body, or `undefined` to rethrow.
 */
export function recoverEchoedResultBody(
  error: unknown,
  { okCodes }: { okCodes: readonly string[] },
): Record<string, unknown> | undefined {
  if (!(error instanceof TronNodeError)) return undefined
  const body = error.response
  if (!body || typeof body !== 'object') return undefined
  const b = body as Record<string, unknown>
  const result = b.result
  if (!result || typeof result !== 'object') return undefined
  const code = (result as Record<string, unknown>).code
  if (typeof code !== 'string' || !okCodes.includes(code)) return undefined
  return b
}
