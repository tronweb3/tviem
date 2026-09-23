import type { Abi, AbiFunction, ExtractAbiFunction } from 'abitype'
import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import type { RequestErrorType } from '../../clients/transports/http.js'
import {
  IntegerOutOfRangeError,
  type IntegerOutOfRangeErrorType,
} from '../../errors/encoding.js'
import { TronContractValidateError } from '../../errors/node.js'
import {
  AccountNotFoundError,
  type AccountNotFoundErrorType,
  type ContractFunctionRevertedErrorType,
  TronRpcError,
  type TronRpcErrorType,
} from '../../errors/rpc.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Address, AddressInput } from '../../types/address.js'
import type { ContractFunctionName } from '../../types/contract.js'
import type { TronAbiParametersToPrimitiveTypes } from '../../utils/abi/encodeAbiParameters.js'
import {
  type EncodeFunctionDataErrorType,
  encodeFunctionData,
} from '../../utils/abi/encodeFunctionData.js'
import {
  type AddressToHexErrorType,
  addressToHex,
} from '../../utils/address/addressToHex.js'
import { decodeRevert } from '../utils/decodeRevert.js'

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
  /**
   * Estimate against confirmed (solidified) state on the SolidityNode instead
   * of the FullNode's latest state. `vm.estimateEnergy` is a per-node setting,
   * so the solidity service must have it enabled too — a node without it
   * rejects the call even when the full node accepts it. @default false
   */
  confirmed?: boolean | undefined
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
  | ContractFunctionRevertedErrorType
  | EncodeFunctionDataErrorType
  | IntegerOutOfRangeErrorType
  | RequestErrorType
  | TronRpcErrorType
  | AddressToHexErrorType
  | ErrorType

/** Shape of the `estimateenergy` response body we consume. */
type EstimateEnergyResponse = {
  result?:
    | { result?: boolean; code?: string; message?: string | undefined }
    | undefined
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
 * A call that fails to execute — a REVERT, out of energy, an invalid opcode —
 * throws a {@link ContractFunctionRevertedError} carrying the node's reason,
 * the same error `readContract` / `triggerConstantContract` throw, whichever
 * of java-tron's two failure shapes reported it. Validate-stage rejections
 * (energy estimation disabled, not a contract) keep the transport's
 * `TronContractValidateError`.
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
    confirmed,
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

  // java-tron (Wallet.estimateEnergy) reports a failed estimate through the
  // nested `result` object in two shapes, both hex-encoding the message and
  // neither carrying `result: false` (proto3 omits the default):
  //   - the first run fails at the max fee limit → `{ code: CONTRACT_EXE_ERROR,
  //     message }`, which the transport's Form 2 check throws as a
  //     TronContractValidateError before this action sees the body;
  //   - the confirmation run after the binary search fails → `{ message }`
  //     ONLY (`txRetBuilder` is cleared per run and `code` is set nowhere on
  //     that path).
  // Both are the contract failing to execute for this caller — the same thing
  // `triggerconstantcontract` reports via `message` — so both surface as the
  // ContractFunctionRevertedError the sibling actions throw. Other codes
  // (CONTRACT_VALIDATE_ERROR: estimation disabled, not a contract) are node
  // rejections, not reverts, and pass through.
  let response: EstimateEnergyResponse
  try {
    response = await client.request<EstimateEnergyResponse>({
      node: confirmed ? 'solidity' : 'full',
      method: 'POST',
      path: 'estimateenergy',
      body: {
        owner_address: addressToHex(owner),
        contract_address: addressToHex(address),
        data: data.slice(2),
        ...(callValue !== undefined ? { call_value: Number(callValue) } : {}),
        ...(callTokenValue !== undefined
          ? { call_token_value: Number(callTokenValue) }
          : {}),
        ...(tokenId !== undefined ? { token_id: Number(tokenId) } : {}),
      },
    })
  } catch (err) {
    if (
      err instanceof TronContractValidateError &&
      err.code === 'CONTRACT_EXE_ERROR'
    )
      throw decodeRevert(
        undefined,
        (err.response as EstimateEnergyResponse | undefined)?.result?.message,
        { functionName },
      )
    throw err
  }

  if (response?.result?.message || response?.result?.result === false)
    throw decodeRevert(undefined, response.result.message, { functionName })

  // A success body always says `result: true`; `energy_required` is omitted
  // only when it is 0 (proto3 default). A body with neither is not an
  // estimate — returning `0n` for it would hand the caller a fee limit that
  // means nothing.
  if (
    response?.energy_required === undefined &&
    response?.result?.result !== true
  )
    throw new TronRpcError(
      'Malformed estimateenergy response: missing `energy_required`.',
      { metaMessages: ['Path: estimateenergy'] },
    )
  return BigInt(response.energy_required ?? 0)
}
