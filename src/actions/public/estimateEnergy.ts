// TRON-specific, clean-room implementation for @tronweb3/omni (WR-4).
import type { Abi } from 'abitype'
import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import { zeroAddress } from '../../constants/address.js'
import { IntegerOutOfRangeError } from '../../errors/encoding.js'
import { parseAccount } from '../../types/account.js'
import type { Address } from '../../types/address.js'
import type { Hex } from '../../types/misc.js'
import { encodeFunctionData } from '../../utils/abi/encodeFunctionData.js'
import { toHex } from '../../utils/address/toHex.js'
import { assertRpcSuccess } from '../utils/normalizeResponse.js'

export type EstimateEnergyParameters = {
  /** The caller account (falls back to `client.account`, else the zero address). */
  account?: TronAccount | Hex | undefined
  /** The contract's Base58Check address. */
  address: Address
  /** The contract ABI. */
  abi: Abi
  /** The function to call. */
  functionName: string
  /** The function arguments. */
  args?: readonly unknown[] | undefined
  /** TRX value (in SUN) attached to the call. */
  callValue?: bigint | undefined
}
export type EstimateEnergyReturnType = bigint

/** Shape of the `triggerconstantcontract` response body we consume. */
type TriggerConstantContractResponse = {
  result?: { result?: boolean; message?: string } | undefined
  energy_used?: number | undefined
}

/**
 * Estimates the energy a contract call would consume via
 * `triggerconstantcontract`, using the real caller `owner_address` (so the
 * estimate reflects the caller's on-chain state). Returns `energy_used` as a
 * `bigint`.
 *
 * This only helps a caller choose a `feeLimit` bound for `writeContract`; it
 * never affects what is signed or broadcast, so it does not weaken the
 * trustless build path.
 *
 * @param client The Client to use.
 * @param parameters Contract address / ABI / function / args / caller.
 * @returns The estimated energy usage (`energy_used`), as a `bigint`.
 */
export async function estimateEnergy(
  client: Client,
  parameters: EstimateEnergyParameters,
): Promise<EstimateEnergyReturnType> {
  const { abi, address, args, callValue, functionName } = parameters

  // The request body is JSON, where an int64 becomes a JS number — so a
  // `call_value` past the safe-integer range would be silently rounded. Reject
  // it rather than send a corrupted estimate (energy estimation never affects
  // what is signed, so a hard error here is safe).
  if (
    callValue !== undefined &&
    (callValue < 0n || callValue > BigInt(Number.MAX_SAFE_INTEGER))
  )
    throw new IntegerOutOfRangeError({
      max: String(Number.MAX_SAFE_INTEGER),
      min: '0',
      value: String(callValue),
    })

  const source = parameters.account ?? client.account
  const owner = source ? parseAccount(source).address : zeroAddress

  const data = encodeFunctionData({ abi, functionName, args })

  const response = await client.request<TriggerConstantContractResponse>({
    node: 'full',
    method: 'POST',
    path: 'triggerconstantcontract',
    body: {
      owner_address: toHex(owner),
      contract_address: toHex(address),
      data: data.slice(2),
      ...(callValue !== undefined ? { call_value: Number(callValue) } : {}),
    },
  })

  assertRpcSuccess(response, { path: 'triggerconstantcontract' })
  return BigInt(response?.energy_used ?? 0)
}
