import type { SignableTransaction } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import type { RequestErrorType } from '../../clients/transports/http.js'
import {
  TransactionTamperedError,
  type TransactionTamperedErrorType,
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
  type DecodeRawDataErrorType,
  decodeRawData,
} from '../../utils/transaction/decodeRawData.js'
import { isEmptyResponse } from './getNowBlock.js'

export type GetTransactionParameters = {
  /** The transaction id (64 hex chars; a `0x` prefix is tolerated). */
  hash: string
  /**
   * Read confirmed (solidified) state from the SolidityNode instead of the
   * FullNode — the id then resolves only once the transaction is solidified.
   * @default false
   */
  confirmed?: boolean | undefined
}

/** A packed contract's execution result echo (e.g. `{ contractRet: 'SUCCESS' }`). */
export type TransactionRet = {
  contractRet?: string | undefined
}

export type GetTransactionReturnType =
  | (SignableTransaction & {
      /** Per-contract execution results, present once the transaction executed. */
      ret?: readonly TransactionRet[] | undefined
    })
  | null

export type GetTransactionErrorType =
  | BareHexErrorType
  | DecodeRawDataErrorType
  | HexToBytesErrorType
  | RequestErrorType
  | Sha256ErrorType
  | TransactionTamperedErrorType
  | TronRpcErrorType
  | ErrorType

type RawTransactionResponse = {
  txID?: string | undefined
  /** Present on the wire, but never adopted — `raw_data` is decoded locally. */
  raw_data?: SignableTransaction['raw_data'] | undefined
  raw_data_hex?: string | undefined
  signature?: string[] | undefined
  ret?: readonly TransactionRet[] | undefined
}

/**
 * Fetches a transaction by id via `gettransactionbyid` (FullNode by default,
 * SolidityNode with `confirmed: true`) — the
 * original transaction (`raw_data` / `raw_data_hex` / signatures), not its
 * receipt ({@link getTransactionInfo} reads that). An id the node does not
 * know (never broadcast, or pruned) resolves to `null`.
 *
 * The returned `txID` is recomputed locally as the SHA-256 of the returned
 * `raw_data_hex` bytes and must equal the requested `hash` — and the node's
 * echoed `txID`, when present, must agree. A node that returns different
 * bytes than asked for, or mislabels them, throws
 * {@link TransactionTamperedError}. The returned `raw_data` is decoded
 * locally from those id-checked bytes — the node's `raw_data` JSON is not
 * used, so what the caller inspects
 * (recipient, amount, contract) is exactly what the bytes say. The triple is
 * therefore self-consistent by construction, which is the `SignableTransaction`
 * shape `multiSign` / `signTransaction` take — no re-encoding or id recompute
 * is needed. The id check constrains only which bytes the node returned; it
 * does not check what the transaction does.
 *
 * @param client The Client to use.
 * @param parameters `hash` — the transaction id.
 * @returns The transaction triple (+ `signature` / `ret` echoes), or `null`
 *   if the node does not know the id.
 */
export async function getTransaction(
  client: Client,
  { confirmed, hash }: GetTransactionParameters,
): Promise<GetTransactionReturnType> {
  const id = bareHex(hash)
  const response = await client.request<RawTransactionResponse>({
    node: confirmed ? 'solidity' : 'full',
    path: 'gettransactionbyid',
    method: 'POST',
    body: { value: id },
  })
  if (isEmptyResponse(response)) return null

  const { raw_data_hex, signature, ret } = response
  if (!raw_data_hex)
    throw new TronRpcError(
      'Malformed gettransactionbyid response: missing `raw_data_hex`.',
      { metaMessages: ['Path: gettransactionbyid'] },
    )

  // `bareHex` yields canonical bare lowercase hex; a value it cannot fully
  // normalize (`0X` prefix, non-hex characters) fails byte decoding and is
  // surfaced as the module's typed malformed-body error.
  const canonicalHex = bareHex(raw_data_hex)
  let bytes: ByteArray
  try {
    bytes = hexToBytes(`0x${canonicalHex}` as Hex)
  } catch {
    throw new TronRpcError(
      'Malformed gettransactionbyid response: `raw_data_hex` is not valid hex.',
      { metaMessages: ['Path: gettransactionbyid'] },
    )
  }

  // Fail closed on substitution: the bytes the node returned must hash to the
  // id that was asked for, and any echoed txID label must agree.
  const localId = sha256(bytes, 'hex').slice(2)
  const echoedId = response.txID ? bareHex(response.txID) : undefined
  if (localId !== id || (echoedId !== undefined && echoedId !== localId))
    throw new TransactionTamperedError({
      localTxId: id,
      nodeTxId: localId !== id ? localId : echoedId,
      path: 'gettransactionbyid',
      shortMessage: [
        'The node returned a transaction that does not hash to the requested transaction id.',
        'This can indicate transaction tampering by a malicious or man-in-the-middled node.',
        'The node-supplied transaction was not accepted.',
      ].join('\n'),
    })

  return {
    txID: localId,
    // Decoded from the id-checked bytes, not the node's JSON.
    raw_data: decodeRawData(bytes),
    raw_data_hex: canonicalHex,
    ...(signature ? { signature } : {}),
    ...(ret ? { ret } : {}),
  }
}
