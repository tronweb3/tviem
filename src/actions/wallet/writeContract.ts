// T5 STUB (WR-3) — to be implemented in T5. Export name / path / type names are
// the T3↔T5 contract; T5 replaces the body and tightens the parameter types
// (ABI-typed).
import type { Abi } from 'abitype'
import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import type { Address } from '../../types/address.js'
import type { Hex } from '../../types/misc.js'

export type WriteContractParameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** The contract's Base58Check address. */
  address: Address
  /** The contract ABI. */
  abi: Abi
  /** The function to call. */
  functionName: string
  /** The function arguments. */
  args?: readonly unknown[] | undefined
  /** Fee limit (in SUN) written into `raw_data` (defaults to `defaultFeeLimit`). */
  feeLimit?: bigint | undefined
  /** TRX value (in SUN) to attach to the call. */
  callValue?: bigint | undefined
  /** Injectable clock (ms since epoch) for deterministic tests. */
  now?: bigint | undefined
}
export type WriteContractReturnType = { txID: string }

export async function writeContract(
  _client: Client,
  _parameters: WriteContractParameters,
): Promise<WriteContractReturnType> {
  throw new Error('writeContract is not implemented yet (T5 WR-3).')
}
