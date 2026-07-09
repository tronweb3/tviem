/**
 * Typed loader for the RPC endpoint fixtures in this directory. Mirrors the
 * style of `test/fixtures/tx/loader.ts`.
 *
 * Each fixture is a single self-describing envelope pinning one endpoint
 * interaction: the gold-standard `request` (the assertion target for the body
 * a local pipeline builds) and the recorded `response` (fed to the mock
 * transport). `getnowblock.fixed` pins a block number and blockID chosen so its
 * derived TaPoS parameters match the canonical transfer transaction fixture,
 * enabling deterministic, offline byte-level write-pipeline assertions.
 *
 * `source` records provenance:
 * - `nile-recorded`          — captured once from a real Nile node.
 * - `hand-crafted`           — authored by hand (error bodies, edge cases).
 * - `derived-from-tx-fixture`— derived from the v0.1a `tx`/`sig` gold vectors.
 */
import { readFileSync } from 'node:fs'

/** Provenance of a fixture. */
export type RpcSource =
  | 'nile-recorded'
  | 'hand-crafted'
  | 'derived-from-tx-fixture'

/** The gold-standard request an endpoint interaction should send. */
export type RpcRequest<body = unknown> = {
  /** Node role (`'full'` | `'solidity'`). Defaults to `'full'` when omitted. */
  node?: 'full' | 'solidity'
  /** Endpoint path without host or node prefix (e.g. `getaccount`). */
  path: string
  /** HTTP verb. Defaults to `'POST'` when omitted. */
  method?: 'GET' | 'POST'
  /** JSON request body (omitted for `GET`). */
  body?: body
}

/** One RPC endpoint fixture envelope. */
export type RpcFixture<request = unknown, response = unknown> = {
  /** Endpoint path this fixture describes (e.g. `getnowblock`). */
  endpoint: string
  /** Human-readable description of the scenario. */
  description: string
  /** Gold-standard request (assertion target). */
  request: RpcRequest<request>
  /** Recorded node response body (fed to the mock via `{ response }`). */
  response: response
  /** ISO-8601 timestamp the fixture was captured or authored. */
  recordedAt: string
  /** Provenance of the fixture. */
  source: RpcSource
}

/**
 * The base RPC fixtures established by T7. Endpoint-specific fixtures for the
 * read (T4) and write (T5) pipelines are added alongside these by their tasks.
 * Names are `readJson`/`rpcFixture` keys (path relative to this dir, no `.json`).
 */
export const rpcFixtureNames = [
  'getnowblock.fixed',
  'getchainparameters',
  'getaccount',
  'getblockbynum',
  'gettransactioninfobyid.success',
  'gettransactioninfobyid.reverted',
  'triggerconstantcontract.trc20-balanceof',
  'errors/contract-validate',
  'errors/tapos-expired',
] as const

function readJson<request = unknown, response = unknown>(
  name: string,
): RpcFixture<request, response> {
  return JSON.parse(
    readFileSync(new URL(`${name}.json`, import.meta.url), 'utf8'),
  ) as RpcFixture<request, response>
}

/**
 * Loads a full RPC fixture envelope by name (path relative to this directory,
 * without the `.json` suffix), e.g. `rpcFixture('errors/contract-validate')`.
 */
export function rpcFixture<request = unknown, response = unknown>(
  name: string,
): RpcFixture<request, response> {
  return readJson<request, response>(name)
}

/**
 * Loads only a fixture's `response` body — the value to feed a mock transport
 * (`{ response: rpc(name) }`).
 */
export function rpc<response = unknown>(name: string): response {
  return readJson<unknown, response>(name).response
}

/**
 * Loads only a fixture's gold-standard `request` — the value to assert a
 * locally built request against.
 */
export function rpcReq<request = unknown>(name: string): RpcRequest<request> {
  return readJson<request>(name).request
}
