import type { Client } from '../../clients/createClient.js'
import {
  decodeNodeMessage,
  parseNodeJson,
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
import type { ByteArray, Hex } from '../../types/misc.js'
import { type BareHexErrorType, bareHex } from '../../utils/encoding/bareHex.js'
import {
  type HexToBytesErrorType,
  hexToBytes,
} from '../../utils/encoding/toBytes.js'
import { type Sha256ErrorType, sha256 } from '../../utils/hash/sha256.js'
import {
  type ReadMessageFieldsErrorType,
  readMessageFields,
} from '../../utils/transaction/protobuf/reader.js'
import {
  type AssertRpcSuccessErrorType,
  assertRpcSuccess,
} from '../utils/normalizeResponse.js'

export type BroadcastHexParameters = {
  /**
   * The full signed `Transaction` protobuf as hex (bare or `0x`-prefixed,
   * any case) — e.g. `toBroadcastHex` output, or bytes serialized by another
   * stack entirely.
   */
  transaction: string
}
export type BroadcastHexReturnType = {
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
  /**
   * The node's echo of the relayed transaction: the acknowledgement's
   * `transaction` field — the transaction the node decoded from the bytes,
   * a JSON string — parsed ({@link parseNodeJson}, so unsafe int64 literals
   * survive as `bigint`). Omitted when not echoed or not parseable.
   * Informational only: like `result`/`code`/`message` it is the node's own
   * reading, never verified locally (the returned `txid` never comes from
   * it).
   */
  transaction?: unknown | undefined
}

/** The `broadcasthex` acknowledgement body. */
type RawBroadcastResponse = {
  result?: boolean | undefined
  txid?: string | undefined
  code?: string | undefined
  message?: string | undefined
  transaction?: string | undefined
}

export type BroadcastHexErrorType =
  | AssertRpcSuccessErrorType
  | BareHexErrorType
  | HexToBytesErrorType
  | ReadMessageFieldsErrorType
  | RequestErrorType
  | Sha256ErrorType
  | TransactionExpiredErrorType
  | TronRpcErrorType
  | ErrorType

/**
 * TRON broadcast rejection codes that mean the transaction's reference block
 * expired before it could be included — surfaced as a dedicated error so a
 * caller can rebuild and retry.
 */
const expirationCodes = new Set(['TRANSACTION_EXPIRATION_ERROR', 'TAPOS_ERROR'])

/**
 * Broadcasts an already-signed transaction via `broadcasthex` (full node): the
 * body is the full signed `Transaction` protobuf as hex, which the node relays
 * verbatim without re-parsing any JSON. This is the byte-exact counterpart to
 * `broadcastTransaction` (whose `broadcasttransaction` body is the
 * snake_case model the node re-serializes): wire fields the JSON model layer
 * does not represent survive here untouched, so it is the path for bytes
 * produced by another stack.
 *
 * The hex is decoded and its protobuf frame read before any request is sent:
 * exactly one `raw_data` (field 1) and at least one `signature` (field 2) must
 * be present — an unsigned or frameless payload is refused locally. The
 * returned `txid` is computed locally as `sha256(raw_data)` from those exact
 * bytes (bare lowercase hex); the node's echoed `txid` is deliberately not
 * read, while the rest of the acknowledgement (`result`, `code`, `message`,
 * and the node-decoded `transaction`) is passed through — `message`
 * hex-decoded to UTF-8 like the error paths, `transaction` parsed from the
 * node's JSON string ({@link parseNodeJson}). No further model-level checks
 * run: the relayed bytes are the signed bytes by construction, so there is
 * no model/byte drift for a `txCheck` to catch.
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
 * @param parameters The signed transaction hex to broadcast.
 * @returns `{ txid, result, code, message, transaction }` — the locally
 * computed transaction id and the node's acknowledgement fields (when echoed,
 * `transaction` being the node-decoded transaction, parsed).
 */
export async function broadcastHex(
  client: Client,
  parameters: BroadcastHexParameters,
): Promise<BroadcastHexReturnType> {
  // Canonical wire spelling: bare lowercase hex. The decoded (validated)
  // bytes and the relayed body both come from this one normalized string.
  const transaction = bareHex(parameters.transaction)
  const bytes = hexToBytes(`0x${transaction}` as Hex)

  // Read the outer `Transaction` frame. `raw_data` must appear exactly once:
  // protobuf merge semantics would concatenate repeated occurrences, making
  // `sha256(raw_data)` ambiguous. Other fields (e.g. `ret`, field 5) are not
  // part of the signed pre-image and ride along untouched.
  let rawData: ByteArray | undefined
  let signatures = 0
  for (const field of readMessageFields(bytes)) {
    if (field.fieldNo === 1) {
      if (field.wireType !== 2 || rawData !== undefined)
        throw new BaseError(
          'The transaction hex does not carry a single well-formed `raw_data` (field 1).',
        )
      rawData = field.value
    } else if (field.fieldNo === 2) {
      if (field.wireType !== 2)
        throw new BaseError(
          'The transaction hex carries a malformed `signature` (field 2).',
        )
      signatures += 1
    }
  }
  if (rawData === undefined)
    throw new BaseError(
      'The transaction hex does not carry a `raw_data` (field 1).',
    )

  // Pre-condition: never broadcast an unsigned transaction.
  if (signatures === 0)
    throw new TronRpcError(
      'Cannot broadcast a transaction without a signature.',
      { metaMessages: ['Path: broadcasthex'] },
    )

  // Trustless invariant: the transaction id is computed from the exact bytes
  // being relayed, never read back from the node.
  const txid = sha256(rawData, 'hex').slice(2)

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
        body: { transaction },
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
      throw new TransactionExpiredError({ hash: txid, cause: error })
    throw error
  }

  // Secondary guard: a `{ result: false }` rejection without a `code` passes
  // through the transport normalizer untouched.
  assertRpcSuccess(response, { path: 'broadcasthex' })

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
      metaMessages: ['Path: broadcasthex'],
    })

  // The echoed transaction is a JSON string; parse it with the node-JSON
  // parser so int64 fields survive losslessly. Informational only — a
  // missing or malformed echo never fails a broadcast the node accepted.
  let echoed: unknown
  try {
    if (typeof body.transaction === 'string')
      echoed = parseNodeJson(body.transaction)
  } catch {}

  // The node's remaining acknowledgement fields ride along (`message`
  // hex-decoded, the echoed `transaction` parsed); its echoed `txid` is
  // deliberately not read.
  return {
    txid,
    result: body.result,
    ...(body.code !== undefined ? { code: String(body.code) } : {}),
    ...(body.message !== undefined
      ? { message: decodeNodeMessage(body.message) }
      : {}),
    ...(echoed !== undefined ? { transaction: echoed } : {}),
  }
}
