// TRON-specific, clean-room implementation for @tronweb3/tviem.
import type { SignableTransaction } from '../../accounts/types.js'
import {
  TransactionTamperedError,
  type TransactionTamperedErrorType,
} from '../../errors/rpc.js'
import type { ErrorType } from '../../errors/utils.js'

/** The transaction an endpoint may echo back — only the load-bearing fields. */
export type EchoedTransaction =
  | {
      txID?: string | undefined
      raw_data_hex?: string | undefined
    }
  | undefined

export type AssertUnchangedTransactionErrorType =
  | TransactionTamperedErrorType
  | ErrorType

/**
 * Fails closed when a node's echoed transaction differs from the locally built
 * one. TRON's `getSignWeight` / `getApprovedList` endpoints echo the submitted
 * transaction back; a hardened client must never adopt that copy (TronWeb does,
 * and signs it), so this asserts the echoed `raw_data_hex` and `txID` match the
 * local values byte-for-byte and throws {@link TransactionTamperedError}
 * otherwise. `raw_data_hex` is the load-bearing field — it is the exact bytes
 * that get hashed and signed. When the node echoes no transaction there is
 * nothing to adopt (the caller keeps its local copy), so the check is a no-op.
 *
 * @param local The locally built/signed transaction (source of truth).
 * @param echoed The transaction the node returned, if any.
 * @param options `path` — endpoint path, for the error's meta messages.
 */
export function assertUnchangedTransaction(
  local: SignableTransaction,
  echoed: EchoedTransaction,
  { path }: { path?: string | undefined } = {},
): void {
  if (!echoed) return

  const localHex = local.raw_data_hex?.toLowerCase()
  const localId = local.txID?.toLowerCase()
  const nodeHex = echoed.raw_data_hex?.toLowerCase()
  const nodeId = echoed.txID?.toLowerCase()

  const hexMismatch = nodeHex !== undefined && nodeHex !== localHex
  const idMismatch = nodeId !== undefined && nodeId !== localId

  if (hexMismatch || idMismatch)
    throw new TransactionTamperedError({
      localTxId: local.txID,
      nodeTxId: echoed.txID,
      path,
    })
}
