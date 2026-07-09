// T5 STUB (WR-1) — to be implemented in T5. Export name / path / type names are
// the T3↔T5 contract; T5 replaces the body.
import type { SignableTransaction } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'

export type BroadcastTransactionParameters = {
  /** A signed transaction (must already carry at least one signature). */
  signedTransaction: SignableTransaction
}
export type BroadcastTransactionReturnType = { txid: string }

export async function broadcastTransaction(
  _client: Client,
  _parameters: BroadcastTransactionParameters,
): Promise<BroadcastTransactionReturnType> {
  throw new Error('broadcastTransaction is not implemented yet (T5 WR-1).')
}
