// T5 STUB (WR-2) — to be implemented in T5. Export name / path / type names are
// the T3↔T5 contract; T5 replaces the body.
import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import type { Address } from '../../types/address.js'
import type { Hex } from '../../types/misc.js'

export type SendTrxParameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Recipient Base58Check address. */
  to: Address
  /** Amount to send, in SUN. */
  amount: bigint
  /** Injectable clock (ms since epoch) for deterministic tests. */
  now?: bigint | undefined
}
export type SendTrxReturnType = { txID: string }

export async function sendTrx(
  _client: Client,
  _parameters: SendTrxParameters,
): Promise<SendTrxReturnType> {
  throw new Error('sendTrx is not implemented yet (T5 WR-2).')
}
