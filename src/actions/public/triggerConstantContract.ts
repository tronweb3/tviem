import type {
  Abi,
  AbiFunction,
  AbiStateMutability,
  ExtractAbiFunction,
} from 'abitype'
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
  type ContractFunctionRevertedErrorType,
} from '../../errors/rpc.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Address, AddressInput } from '../../types/address.js'
import type {
  ContractFunctionName,
  TronContractFunctionArgs,
  TronContractFunctionReturnType,
} from '../../types/contract.js'
import type { IsUnion } from '../../types/utils.js'
import type { DecodeAbiParametersErrorType } from '../../utils/abi/decodeAbiParameters.js'
import {
  type DecodeFunctionResultErrorType,
  decodeFunctionResult,
} from '../../utils/abi/decodeFunctionResult.js'
import type { TronAbiParametersToPrimitiveTypes } from '../../utils/abi/encodeAbiParameters.js'
import {
  type EncodeFunctionDataErrorType,
  encodeFunctionData,
} from '../../utils/abi/encodeFunctionData.js'
import { type ToHexErrorType, toHex } from '../../utils/address/toHex.js'
import type { HexToStringErrorType } from '../../utils/encoding/fromHex.js'
import { decodeRevert } from '../utils/decodeRevert.js'

export type TriggerConstantContractParameters<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends ContractFunctionName<abi> = ContractFunctionName<abi>,
  args extends TronContractFunctionArgs<
    abi,
    AbiStateMutability,
    functionName
  > = TronContractFunctionArgs<abi, AbiStateMutability, functionName>,
  ///
  allFunctionNames = ContractFunctionName<abi>,
  abiFunction extends AbiFunction = abi extends Abi
    ? ExtractAbiFunction<abi, functionName>
    : AbiFunction,
  // Falls back to `readonly unknown[]` when the function cannot be extracted
  // (wide abi, empty abi, unknown name) so the wide call shape keeps working.
  allArgs = [abiFunction] extends [never]
    ? readonly unknown[]
    : TronAbiParametersToPrimitiveTypes<abiFunction['inputs'], 'inputs'>,
> = {
  /** The contract's Base58Check address. */
  address: Address
  /** The contract ABI. */
  abi: abi
  /** The function to call — any state mutability, writes included. */
  functionName:
    | allFunctionNames // show all options
    | (functionName extends allFunctionNames ? functionName : never) // infer value
  /**
   * The caller the simulated call runs as — sent as `owner_address`. Accepts an
   * account or any TRON address form; falls back to the Client's `account`.
   * With neither, an {@link AccountNotFoundError} is thrown.
   *
   * The simulation executes against real chain state, so the caller decides the
   * outcome: `msg.sender`-dependent branches, the caller's own token balance
   * and allowance, and (with `callValue`) its TRX balance. There is no safe
   * default — a placeholder caller would silently simulate someone else's call.
   * java-tron requires `owner_address` on `triggerconstantcontract`, so there
   * is no anonymous form to fall back to either.
   */
  account?: TronAccount | AddressInput | undefined
  /** TRX value (in SUN) attached to the simulated call. */
  callValue?: bigint | undefined
  /** TRC10 amount attached to the simulated call (`call_token_value`). */
  callTokenValue?: bigint | undefined
  /** TRC10 token id (`token_id`). */
  tokenId?: bigint | undefined
  /**
   * Run the simulation against solidified state on the SolidityNode instead
   * of the FullNode's latest state. Solidified state trails the chain head, so
   * the simulation would not see a write made moments ago — while the
   * transaction it simulates will execute against the head. @default false
   */
  confirmed?: boolean | undefined
} & (readonly [] extends allArgs
  ? {
      /** The function arguments. */
      args?:
        | allArgs
        // capture the literal tuple so overloads narrow by their args
        | (IsUnion<abiFunction> extends true ? args : never)
        | undefined
    }
  : {
      /** The function arguments. */
      args: IsUnion<abiFunction> extends true ? args : allArgs
    })

export type TriggerConstantContractReturnType<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends ContractFunctionName<abi> = ContractFunctionName<abi>,
  args extends TronContractFunctionArgs<
    abi,
    AbiStateMutability,
    functionName
  > = TronContractFunctionArgs<abi, AbiStateMutability, functionName>,
> = {
  /** ABI-decoded return value (`undefined` when the function has no outputs). */
  result: TronContractFunctionReturnType<
    abi,
    AbiStateMutability,
    functionName,
    args
  >
  /** Energy the node reports the call would consume (`energy_used`). */
  energyUsed: bigint
}

export type TriggerConstantContractErrorType =
  | AccountNotFoundErrorType
  | ContractFunctionRevertedErrorType
  | DecodeAbiParametersErrorType
  | DecodeFunctionResultErrorType
  | EncodeFunctionDataErrorType
  | HexToStringErrorType
  | IntegerOutOfRangeErrorType
  | RequestErrorType
  | ToHexErrorType
  | ErrorType

/** Shape of a `triggerconstantcontract` response body. */
type TriggerConstantContractResponse = {
  result?: { result?: boolean; message?: string } | undefined
  constant_result?: string[] | undefined
  energy_used?: number | undefined
}

/**
 * Constant-calls (simulates) a contract function via `triggerconstantcontract`
 * without broadcasting a transaction. Unlike {@link readContract} it accepts
 * functions of ANY state mutability — a `nonpayable`/`payable` write is
 * executed against current chain state and rolled back, which surfaces its
 * return value, revert reason and `energy_used` without spending anything.
 *
 * The calldata is built locally with {@link encodeFunctionData} and sent as the
 * bare `data` field (no `0x`). If the node reports the call reverted
 * (`result.result === false`), the revert payload in `constant_result[0]` is
 * decoded (`Error(string)` / `Panic(uint256)`) and thrown as a
 * `ContractFunctionRevertedError`; otherwise `constant_result[0]` is
 * ABI-decoded against the function outputs.
 *
 * This never affects what is signed or broadcast — it is a read-only
 * simulation aid (e.g. preflighting a `writeContract`). Preflight with the same
 * caller you will write with: the caller (`account`, else the Client's hoisted
 * account) is required — see
 * {@link TriggerConstantContractParameters.account}.
 *
 * @example
 * const { result, energyUsed } = await triggerConstantContract(client, {
 *   address: 'T...',
 *   abi: trc20Abi,
 *   functionName: 'transfer', // nonpayable — fine here
 *   args: ['T...', 1_000_000n],
 *   account: 'T...', // the caller the simulation runs as
 * })
 */
export async function triggerConstantContract<
  const abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi>,
  const args extends TronContractFunctionArgs<
    abi,
    AbiStateMutability,
    functionName
  > = TronContractFunctionArgs<abi, AbiStateMutability, functionName>,
>(
  client: Client,
  parameters: TriggerConstantContractParameters<abi, functionName, args>,
): Promise<TriggerConstantContractReturnType<abi, functionName, args>> {
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
  } = parameters as TriggerConstantContractParameters

  // The request body is JSON, where an int64 becomes a JS number — so a
  // `call_value` / `call_token_value` / `token_id` past the safe-integer range
  // would be silently rounded. Reject it rather than simulate against a
  // corrupted value.
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
  // the simulation's outcome depends on who runs it.
  const source = caller ?? client.account
  if (!source) throw new AccountNotFoundError()
  const owner = typeof source === 'string' ? source : source.address

  const data = encodeFunctionData({ abi, functionName, args })

  const response = await client.request<TriggerConstantContractResponse>({
    node: confirmed ? 'solidity' : 'full',
    method: 'POST',
    path: 'triggerconstantcontract',
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

  // See `readContract`: java-tron reports a failed constant call via `message`,
  // leaving `result: true` on a REVERT, so `result === false` alone never fires
  // against a real node.
  if (response?.result?.message || response?.result?.result === false)
    throw decodeRevert(response.constant_result?.[0], response.result.message, {
      functionName,
    })

  const constantResult = response?.constant_result?.[0] ?? ''
  const result = decodeFunctionResult({
    abi,
    functionName,
    args,
    data: `0x${constantResult}`,
  }) as TriggerConstantContractReturnType<abi, functionName, args>['result']
  return { result, energyUsed: BigInt(response?.energy_used ?? 0) }
}
