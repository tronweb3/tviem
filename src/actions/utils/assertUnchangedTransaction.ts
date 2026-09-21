import type { SignableTransaction } from '../../accounts/types.js'
import { TransactionTamperedError } from '../../errors/rpc.js'
import { bareHex } from '../../utils/encoding/bareHex.js'

/** The transaction an endpoint may echo back — only the load-bearing fields. */
export type EchoedTransaction =
  | {
      txID?: string | undefined
      raw_data_hex?: string | undefined
    }
  | undefined

/**
 * Fails closed when a node's echoed transaction differs from the locally built
 * one. TRON's `getSignWeight` / `getApprovedList` endpoints echo the submitted
 * transaction back; this client does not adopt that copy — it asserts the
 * echoed `raw_data_hex` and `txID` match the local values byte-for-byte and
 * throws {@link TransactionTamperedError} otherwise. `raw_data_hex` is the
 * load-bearing field — it is the exact bytes that get hashed and signed. When
 * the node echoes no transaction there is nothing to adopt (the caller keeps
 * its local copy), so the check is a no-op.
 *
 * The comparison is over the bytes, not their spelling: both sides go through
 * `bareHex`, as `txCheck` and the signing paths do. Those accept — and hand
 * back — a `0x`-prefixed or upper-case `txID` / `raw_data_hex`, while a node
 * echoes its own bare lowercase rendering; folding case alone would report
 * that honest echo as tampering.
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

  const localHex = canonicalHex(local.raw_data_hex)
  const localId = canonicalHex(local.txID)
  const nodeHex = canonicalHex(echoed.raw_data_hex)
  const nodeId = canonicalHex(echoed.txID)

  const hexMismatch = nodeHex !== undefined && nodeHex !== localHex
  const idMismatch = nodeId !== undefined && nodeId !== localId

  if (hexMismatch || idMismatch)
    throw new TransactionTamperedError({
      localTxId: local.txID,
      nodeTxId: echoed.txID,
      path,
    })
}

/**
 * `bareHex` for a field that may be absent. Anything that is not a string is
 * passed through as-is: a node is free to echo garbage, and it should compare
 * unequal — a mismatch — rather than escape as a raw TypeError.
 */
function canonicalHex(value: string | undefined): string | undefined {
  return typeof value === 'string' ? bareHex(value) : value
}
