import type { Abi, AbiFunction, ExtractAbiFunction } from 'abitype'
import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import { zeroAddress } from '../../constants/address.js'
import { IntegerOutOfRangeError } from '../../errors/encoding.js'
import { parseAccount } from '../../types/account.js'
import type { Address } from '../../types/address.js'
import type { ContractFunctionName } from '../../types/contract.js'
import type { Hex } from '../../types/misc.js'
import type { TronAbiParametersToPrimitiveTypes } from '../../utils/abi/encodeAbiParameters.js'
import { encodeFunctionData } from '../../utils/abi/encodeFunctionData.js'
import { toHex } from '../../utils/address/toHex.js'
import { assertRpcSuccess } from '../utils/normalizeResponse.js'

export type EstimateEnergyParameters<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends ContractFunctionName<
    abi,
    'nonpayable' | 'payable'
  > = ContractFunctionName<abi, 'nonpayable' | 'payable'>,
  ///
  allFunctionNames = ContractFunctionName<abi, 'nonpayable' | 'payable'>,
  abiFunction extends AbiFunction = abi extends Abi
    ? ExtractAbiFunction<abi, functionName, 'nonpayable' | 'payable'>
    : AbiFunction,
  // Falls back to `readonly unknown[]` when the function cannot be extracted
  // (wide abi, empty abi, unknown name) so the wide call shape keeps working.
  allArgs = [abiFunction] extends [never]
    ? readonly unknown[]
    : TronAbiParametersToPrimitiveTypes<abiFunction['inputs'], 'inputs'>,
> = {
  /** The caller account (falls back to `client.account`, else the zero address). */
  account?: TronAccount | Hex | undefined
  /** The contract's Base58Check address. */
  address: Address
  /** The contract ABI. */
  abi: abi
  /** The function to call. */
  functionName:
    | allFunctionNames // show all options
    | (functionName extends allFunctionNames ? functionName : never) // infer value
  /** TRX value (in SUN) attached to the call. */
  callValue?: bigint | undefined
} & (readonly [] extends allArgs
  ? {
      /** The function arguments. */
      args?: allArgs | undefined
    }
  : {
      /** The function arguments. */
      args: allArgs
    })
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
export async function estimateEnergy<
  const abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'>,
>(
  client: Client,
  parameters: EstimateEnergyParameters<abi, functionName>,
): Promise<EstimateEnergyReturnType> {
  const { abi, address, args, callValue, functionName } =
    parameters as EstimateEnergyParameters

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
