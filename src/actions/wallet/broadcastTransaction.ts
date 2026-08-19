import type { SignableTransaction } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import {
  decodeNodeMessage,
  type RequestErrorType,
} from '../../clients/transports/http.js'
import { BaseError } from '../../errors/base.js'
import { TronNodeError } from '../../errors/node.js'
import {
  TransactionExpiredError,
  type TransactionExpiredErrorType,
  TronRpcError,
  type TronRpcErrorType,
} from '../../errors/rpc.js'
import type { ErrorType } from '../../errors/utils.js'
import { bareHex } from '../../utils/encoding/bareHex.js'
import {
  type TxCheckErrorType,
  txCheck,
} from '../../utils/transaction/txCheck.js'
import {
  type AssertRpcSuccessErrorType,
  assertRpcSuccess,
} from '../utils/normalizeResponse.js'

export type BroadcastTransactionParameters = {
  /** A signed transaction (must already carry at least one signature). */
  signedTransaction: SignableTransaction
}
export type BroadcastTransactionReturnType = {
  /**
   * The **locally** computed transaction id (bare lowercase hex) — never the
   * node's echoed `txid` (see the action's JSDoc).
   */
  txid: string
  /** The node's acknowledgement flag (`true` here — a rejection throws). */
  result?: boolean | undefined
  /** The node's response code, when echoed (e.g. `SUCCESS`). */
  code?: string | undefined
  /** The node's message, hex-decoded to UTF-8 when decodable. */
  message?: string | undefined
}

/** The `broadcasttransaction` acknowledgement body. */
type RawBroadcastResponse = {
  result?: boolean | undefined
  txid?: string | undefined
  code?: string | undefined
  message?: string | undefined
}

export type BroadcastTransactionErrorType =
  | AssertRpcSuccessErrorType
  | RequestErrorType
  | TransactionExpiredErrorType
  | TronRpcErrorType
  | TxCheckErrorType
  | ErrorType

/**
 * TRON broadcast rejection codes that mean the transaction's reference block
 * expired before it could be included — surfaced as a dedicated error so a
 * caller can rebuild and retry.
 */
const expirationCodes = new Set(['TRANSACTION_EXPIRATION_ERROR', 'TAPOS_ERROR'])

/**
 * Broadcasts an already-signed transaction via `broadcasttransaction` (full
 * node): the body is the full signed transaction in node JSON (`txID`,
 * `raw_data`, `raw_data_hex`, `signature`). Node dialect: the node rebuilds
 * the `Transaction` protobuf from the snake_case `raw_data` JSON —
 * `raw_data_hex` is ignored server-side — so the JSON model, not the hex, is
 * what gets relayed.
 *
 * The transaction is integrity-checked before any request is sent (via
 * {@link txCheck}): `raw_data` must serialize to exactly the `raw_data_hex`
 * bytes, whose SHA-256 must equal `txID`. An inconsistent or incomplete
 * triple is refused — the node rebuilds the wire bytes from `raw_data`, so a
 * drifted model would relay bytes the signature no longer covers, reported
 * under a `txid` the relayed transaction could never be found by. The returned
 * `txid` is that checked local `txID` (bare lowercase hex); the node's echoed
 * `txid` is deliberately not read, while the rest of the acknowledgement
 * (`result`, `code`, `message`) is passed through — `message` hex-decoded to
 * UTF-8 like the error paths. This is the same gate every signing path runs,
 * so bytes carrying wire fields the model layer does not represent are
 * refused here the same way they would be at signing.
 *
 * The transport's error normalization already throws for the documented
 * rejection bodies (`{ result: false, code }` → `TronBroadcastError`, etc.); a
 * `{ result: false }` rejection without a `code` is caught here by
 * {@link assertRpcSuccess}, and a body carrying no acknowledgement at all
 * (`{}` from an LB stub / warming node) is refused rather than resolved. A
 * rejection whose code indicates the reference block expired is re-surfaced
 * as a {@link TransactionExpiredError}, with the node rejection as `cause`.
 *
 * @param client The Client to use.
 * @param parameters The signed transaction to broadcast.
 * @returns `{ txid, result, code, message }` — the locally computed
 * transaction id plus the node's acknowledgement fields, when echoed.
 */
export async function broadcastTransaction(
  client: Client,
  parameters: BroadcastTransactionParameters,
): Promise<BroadcastTransactionReturnType> {
  // Snapshot the fields once, so the values integrity-checked below are the
  // same ones serialized into the wire body (a getter-backed object cannot
  // hand txCheck one set of bytes and the request another).
  const { txID, raw_data, raw_data_hex, signature } =
    parameters.signedTransaction
  const signedTransaction = { txID, raw_data, raw_data_hex, signature }

  // Pre-condition: never broadcast an unsigned transaction.
  if (!signature || signature.length === 0)
    throw new TronRpcError(
      'Cannot broadcast a transaction without a signature.',
      { metaMessages: ['Path: broadcasttransaction'] },
    )

  // Pre-condition: the triple must be self-consistent (see the JSDoc). The
  // SDK's own sign paths have already passed this; it is the transaction
  // handed over from elsewhere (TronWeb, another co-signer, disk) whose
  // `txID` has never been checked against the bytes until here.
  if (!txCheck(signedTransaction))
    throw new BaseError('The transaction failed its integrity check (txCheck).')

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
        path: 'broadcasttransaction',
        body: signedTransaction,
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
      throw new TransactionExpiredError({ hash: bareHex(txID), cause: error })
    throw error
  }

  // Secondary guard: a `{ result: false }` rejection without a `code` passes
  // through the transport normalizer untouched.
  assertRpcSuccess(response, { path: 'broadcasttransaction' })

  const body = (
    response && typeof response === 'object' ? response : {}
  ) as RawBroadcastResponse

  // Positive acknowledgement required. java-tron's success body always prints
  // `result: true` (proto3 omits only defaults) and every rejection shape was
  // thrown above — a body with neither (`{}` from an LB stub / warming node)
  // means the transaction may never have reached a node.
  if (body.result !== true)
    throw new TronRpcError('The node did not acknowledge the broadcast.', {
      details: JSON.stringify(body),
      metaMessages: ['Path: broadcasttransaction'],
    })

  // Canonical spelling: txCheck compared via bareHex, so a caller's `0x` or
  // upper-case spelling passes — return the form the check actually ran on.
  // The node's remaining acknowledgement fields ride along (`message`
  // hex-decoded); its echoed `txid` is deliberately not read.
  return {
    txid: bareHex(txID),
    result: body.result,
    ...(body.code !== undefined ? { code: String(body.code) } : {}),
    ...(body.message !== undefined
      ? { message: decodeNodeMessage(body.message) }
      : {}),
  }
}
