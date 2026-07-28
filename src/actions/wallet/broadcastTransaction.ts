// TRON-specific, clean-room implementation for @tronweb3/omni (WR-1).
import type { SignableTransaction } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import { TronNodeError } from '../../errors/node.js'
import { TransactionExpiredError, TronRpcError } from '../../errors/rpc.js'
import { toBroadcastHex } from '../../utils/transaction/serializeTransaction.js'
import { assertRpcSuccess } from '../utils/normalizeResponse.js'

export type BroadcastTransactionParameters = {
  /** A signed transaction (must already carry at least one signature). */
  signedTransaction: SignableTransaction
}
export type BroadcastTransactionReturnType = { txid: string }

/** The `broadcasthex` request body: the full signed `Transaction` protobuf. */
type BroadcastBody = { transaction: string }

/**
 * TRON broadcast rejection codes that mean the transaction's reference block
 * expired before it could be included — surfaced as a dedicated error so a
 * caller can rebuild and retry.
 */
const expirationCodes = new Set(['TRANSACTION_EXPIRATION_ERROR', 'TAPOS_ERROR'])

/**
 * Broadcasts an already-signed transaction via `broadcasthex` (full node): the
 * body is the full signed `Transaction` protobuf as hex, which the node relays
 * verbatim without re-parsing any JSON. This is what lets a locally-built
 * transaction reach a real java-tron node — `broadcasttransaction` rebuilds the
 * transaction from a snake_case `raw_data` JSON and ignores `raw_data_hex`, so
 * the SDK's camelCase model would not deserialize there.
 *
 * Trustless invariant: the returned `txid` is the transaction's **local**
 * `txID` (recomputed at signing time by the four sign guards), never the value
 * the node echoes back. The node's `txid` is not trusted.
 *
 * The transport's error normalization already throws for the documented
 * rejection bodies (`{ result: false, code }` → `TronBroadcastError`, etc.); a
 * `{ result: false }` rejection without a `code` is caught here by
 * {@link assertRpcSuccess}. A rejection whose code indicates the reference
 * block expired is re-surfaced as a {@link TransactionExpiredError}.
 *
 * @param client The Client to use.
 * @param parameters The signed transaction to broadcast.
 * @returns `{ txid }` — the locally computed transaction id.
 */
export async function broadcastTransaction(
  client: Client,
  parameters: BroadcastTransactionParameters,
): Promise<BroadcastTransactionReturnType> {
  const { signedTransaction } = parameters
  const { txID, signature } = signedTransaction

  // Pre-condition: never broadcast an unsigned transaction.
  if (!signature || signature.length === 0)
    throw new TronRpcError(
      'Cannot broadcast a transaction without a signature.',
      { metaMessages: ['Path: broadcasthex'] },
    )

  const body: BroadcastBody = { transaction: toBroadcastHex(signedTransaction) }

  let response: unknown
  try {
    // Broadcast exactly once — no transport retry. Re-sending a signed
    // transaction cannot help: the node dedupes it by `txID`, so a retry after
    // a lost response only comes back as a spurious "already exists" rejection
    // (a success reported as a failure). Confirming inclusion is the caller's
    // job (`waitForTransactionReceipt` / `getTransactionInfo`). This matches
    // TronWeb's single-shot broadcast.
    response = await client.request(
      {
        node: 'full',
        method: 'POST',
        path: 'broadcasthex',
        body,
      },
      { retryCount: 0 },
    )
  } catch (error) {
    // Map an expiration rejection to a dedicated, actionable error.
    if (
      error instanceof TronNodeError &&
      error.code !== undefined &&
      expirationCodes.has(error.code)
    )
      throw new TransactionExpiredError({ hash: txID })
    throw error
  }

  // Secondary guard: a `{ result: false }` rejection without a `code` passes
  // through the transport normalizer untouched.
  assertRpcSuccess(response, { path: 'broadcasthex' })

  // Trustless invariant: the local txID is authoritative.
  return { txid: txID ?? '' }
}
