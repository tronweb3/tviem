/**
 * Transport protocol types (replaces the EVM EIP-1193 request contract).
 *
 * TRON nodes expose a REST surface, so the request contract is expressed in
 * terms of a node role, an endpoint path, an HTTP method and a JSON body —
 * not a JSON-RPC `{ method, params }` envelope.
 */

/** The node role a request is routed to. */
export type TronNode = 'full' | 'solidity' | 'event'

/**
 * A single transport request.
 *
 * - `node` — `'full'` (FullNode `/wallet/*`), `'solidity'`
 *   (SolidityNode `/walletsolidity/*`), or `'event'` (TronGrid `/v1/*` event
 *   index host). Defaults to `'full'`.
 * - `path` — endpoint path **without** host or node prefix (e.g. `getaccount`).
 *   A path starting with `/` is treated as a host-root absolute escape
 *   (e.g. `/jsonrpc`, `/v1/*`) and bypasses the node prefix — event reads use
 *   this with a `/v1/...` path.
 * - `body` — JSON request body (omitted for `GET`).
 * - `method` — HTTP verb. Defaults to `'POST'`.
 */
export type TronRequestArgs = {
  node?: TronNode | undefined
  path: string
  body?: unknown
  method?: 'GET' | 'POST' | undefined
}

/** Per-call / per-transport request tuning. */
export type TronRequestOptions = {
  /** Deduplicate concurrent identical requests. */
  dedupe?: boolean | undefined
  /** Max number of retries. */
  retryCount?: number | undefined
  /** Base delay (in ms) between retries. */
  retryDelay?: number | undefined
  /** AbortSignal to cancel the request (and its retries). */
  signal?: AbortSignal | undefined
  /** Stable id used to salt the dedupe hash. */
  uid?: string | undefined
}

/** The normalized transport request function. */
export type TronRequestFn = <returnType = unknown>(
  args: TronRequestArgs,
  options?: TronRequestOptions | undefined,
) => Promise<returnType>
