import type { SignableTransaction } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import type { RequestErrorType } from '../../clients/transports/http.js'
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { TransactionTamperedErrorType } from '../../errors/rpc.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Address, AddressInput } from '../../types/address.js'
import {
  type ToBase58ErrorType,
  toBase58,
} from '../../utils/address/toBase58.js'
import {
  type CloneTransactionErrorType,
  cloneTransaction,
} from '../../utils/transaction/cloneTransaction.js'
import { assertUnchangedTransaction } from '../utils/assertUnchangedTransaction.js'
import {
  type CanonicalizeTransactionErrorType,
  canonicalizeTransaction,
} from '../utils/canonicalizeTransaction.js'
import { recoverEchoedResultBody } from '../utils/recoverMultisigResult.js'

export type GetApprovedListParameters = {
  /** A locally built (and typically partially-signed) transaction. */
  transaction: SignableTransaction
}

export type GetApprovedListReturnType = {
  /** Addresses (Base58Check) that have already signed. */
  approvedList: Address[]
  /** The node's result status. */
  result?:
    | { code?: string | undefined; message?: string | undefined }
    | undefined
  /**
   * The **local** transaction — a snapshot taken on entry, which is what was
   * sent and what the node's echoed copy was verified against. Its `raw_data`
   * is in the canonical node-JSON shape, whatever spelling the caller passed.
   */
  transaction: SignableTransaction
}

export type GetApprovedListErrorType =
  | BaseErrorType
  | CanonicalizeTransactionErrorType
  | CloneTransactionErrorType
  | RequestErrorType
  | ToBase58ErrorType
  | TransactionTamperedErrorType
  | ErrorType

type RawApprovedList = {
  result?:
    | { code?: string | undefined; message?: string | undefined }
    | undefined
  approved_list?: string[] | undefined
  transaction?:
    | { transaction?: { txID?: string; raw_data_hex?: string } | undefined }
    | undefined
}

/**
 * Reads which addresses have already signed a multi-sig transaction via
 * `getapprovedlist` (full node).
 *
 * Node echo: like {@link getSignWeight}, the node's echoed transaction is
 * asserted to match the local one byte-for-byte (throwing
 * {@link TransactionTamperedError} otherwise), and the returned `transaction`
 * is always the local copy — never the node's. Also like it, the triple is
 * integrity-checked first and `raw_data` is sent as the canonical rendering of
 * the checked bytes (see {@link canonicalizeTransaction}).
 *
 * @param client The Client to use.
 * @param parameters `transaction` — the built transaction to inspect.
 * @returns `{ approvedList, result, transaction }`.
 */
export async function getApprovedList(
  client: Client,
  parameters: GetApprovedListParameters,
): Promise<GetApprovedListReturnType> {
  // Snapshot once, like the sign and broadcast paths: the guard below, the
  // request body and the echo assertion are three separate reads of the
  // caller's object with an `await` between the last two. Read live, the
  // assertion would compare the node's echo against whatever the object says
  // by then rather than against what was sent — accusing an honest node, or
  // passing a forged echo the object has come to match.
  const snapshot = cloneTransaction(parameters.transaction)

  if (!snapshot.raw_data_hex || !snapshot.txID)
    throw new BaseError(
      'getApprovedList requires a built transaction carrying `raw_data_hex` and `txID` (sign or multiSign it first).',
    )

  // The same relay boundary as broadcast: the node rebuilds the transaction
  // from `raw_data`, read as `visible: false` JSON. The triple is checked and
  // `raw_data` re-derived from the checked bytes, so a spelling the signing
  // paths accept but the node does not (Base58, `0x` EVM, raw bytes) is never
  // sent verbatim — and a drifted model is refused here rather than inspected
  // by the node and reported back as a tampered echo.
  const transaction = canonicalizeTransaction(snapshot)

  let response: RawApprovedList
  try {
    response = await client.request<RawApprovedList>({
      node: 'full',
      path: 'getapprovedlist',
      method: 'POST',
      body: {
        txID: transaction.txID,
        // Node dialect: these endpoints rebuild the transaction from the
        // snake_case raw_data JSON (raw_data_hex is ignored server-side).
        raw_data: transaction.raw_data,
        raw_data_hex: transaction.raw_data_hex,
        signature: transaction.signature ?? [],
      },
    })
  } catch (error) {
    const recovered = recoverEchoedResultBody(error)
    if (!recovered) throw error
    response = recovered as RawApprovedList
  }

  assertUnchangedTransaction(transaction, response.transaction?.transaction, {
    path: 'getapprovedlist',
  })

  return {
    approvedList: (response.approved_list ?? []).map((address) =>
      toBase58(address as AddressInput),
    ),
    ...(response.result ? { result: response.result } : {}),
    transaction,
  }
}
