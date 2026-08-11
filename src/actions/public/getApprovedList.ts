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
import { assertUnchangedTransaction } from '../utils/assertUnchangedTransaction.js'
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
  /** The **local** transaction, re-verified against the node's echoed copy. */
  transaction: SignableTransaction
}

export type GetApprovedListErrorType =
  | BaseErrorType
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
 * is always the local copy — never the node's.
 *
 * @param client The Client to use.
 * @param parameters `transaction` — the built transaction to inspect.
 * @returns `{ approvedList, result, transaction }`.
 */
export async function getApprovedList(
  client: Client,
  { transaction }: GetApprovedListParameters,
): Promise<GetApprovedListReturnType> {
  if (!transaction.raw_data_hex || !transaction.txID)
    throw new BaseError(
      'getApprovedList requires a built transaction carrying `raw_data_hex` and `txID` (sign or multiSign it first).',
    )

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
