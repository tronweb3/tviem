import type { Abi, AbiFunction, ExtractAbiFunction } from 'abitype'
import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import type { RequestErrorType } from '../../clients/transports/http.js'
import {
  IntegerOutOfRangeError,
  type IntegerOutOfRangeErrorType,
} from '../../errors/encoding.js'
import {
  AccountNotFoundError,
  type AccountNotFoundErrorType,
} from '../../errors/rpc.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Address, AddressInput } from '../../types/address.js'
import type { ContractFunctionName } from '../../types/contract.js'
import type { TronAbiParametersToPrimitiveTypes } from '../../utils/abi/encodeAbiParameters.js'
import {
  type EncodeFunctionDataErrorType,
  encodeFunctionData,
} from '../../utils/abi/encodeFunctionData.js'
import { type ToHexErrorType, toHex } from '../../utils/address/toHex.js'
import {
  type AssertRpcSuccessErrorType,
  assertRpcSuccess,
} from '../utils/normalizeResponse.js'

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
  /**
   * The caller the estimate is computed for — sent as `owner_address`. Accepts
   * an account or any TRON address form; falls back to the Client's `account`.
   * With neither, an {@link AccountNotFoundError} is thrown.
   *
   * The node executes the call against real chain state, so energy depends on
   * the caller: storage slots keyed by `msg.sender` cost more to write when
   * they are zero, and a call that would revert for this caller estimates
   * nothing useful. There is no safe default — and java-tron requires
   * `owner_address` on `estimateenergy`, so there is no anonymous form either.
   */
  account?: TronAccount | AddressInput | undefined
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
  /** TRC10 amount attached to the call (`call_token_value`). */
  callTokenValue?: bigint | undefined
  /** TRC10 token id (`token_id`). */
  tokenId?: bigint | undefined
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

export type EstimateEnergyErrorType =
  | AccountNotFoundErrorType
  | AssertRpcSuccessErrorType
  | EncodeFunctionDataErrorType
  | IntegerOutOfRangeErrorType
  | RequestErrorType
  | ToHexErrorType
  | ErrorType

/** Shape of the `estimateenergy` response body we consume. */
type EstimateEnergyResponse = {
  result?: { result?: boolean; message?: string } | undefined
  energy_required?: number | undefined
}

/**
 * Estimates the energy a contract call would consume via
 * `wallet/estimateenergy`, using the real caller `owner_address` (so the
 * estimate reflects the caller's on-chain state). Returns `energy_required`
 * as a `bigint`.
 *
 * The node must have energy estimation enabled (`vm.estimateEnergy = true`);
 * a node without it rejects the call and the RPC error is surfaced.
 *
 * This only helps a caller choose a `feeLimit` bound for `writeContract`; it
 * never affects what is signed or broadcast.
 *
 * @param client The Client to use.
 * @param parameters Contract address / ABI / function / args / caller.
 * @returns The estimated energy usage (`energy_required`), as a `bigint`.
 */
export async function estimateEnergy<
  const abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'>,
>(
  client: Client,
  parameters: EstimateEnergyParameters<abi, functionName>,
): Promise<EstimateEnergyReturnType> {
  const {
    abi,
    account: caller,
    address,
    args,
    callTokenValue,
    callValue,
    functionName,
    tokenId,
  } = parameters as EstimateEnergyParameters

  // The request body is JSON, where an int64 becomes a JS number — so a
  // `call_value` / `call_token_value` / `token_id` past the safe-integer range
  // would be silently rounded. Reject it rather than send a corrupted estimate
  // (energy estimation never affects what is signed).
  for (const value of [callValue, callTokenValue, tokenId])
    if (
      value !== undefined &&
      (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
    )
      throw new IntegerOutOfRangeError({
        max: String(Number.MAX_SAFE_INTEGER),
        min: '0',
        value: String(value),
      })

  // Resolve the caller (per-call, else hoisted on the Client). Never defaulted:
  // the estimate is only meaningful for the account that will send the call.
  const source = caller ?? client.account
  if (!source) throw new AccountNotFoundError()
  const owner = typeof source === 'string' ? source : source.address

  const data = encodeFunctionData({ abi, functionName, args })

  const response = await client.request<EstimateEnergyResponse>({
    node: 'full',
    method: 'POST',
    path: 'estimateenergy',
    body: {
      owner_address: toHex(owner),
      contract_address: toHex(address),
      data: data.slice(2),
      ...(callValue !== undefined ? { call_value: Number(callValue) } : {}),
      ...(callTokenValue !== undefined
        ? { call_token_value: Number(callTokenValue) }
        : {}),
      ...(tokenId !== undefined ? { token_id: Number(tokenId) } : {}),
    },
  })

  assertRpcSuccess(response, { path: 'estimateenergy' })
  return BigInt(response?.energy_required ?? 0)
}
