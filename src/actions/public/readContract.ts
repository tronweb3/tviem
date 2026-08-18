import type { Abi, AbiFunction, ExtractAbiFunction } from 'abitype'
import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import type { RequestErrorType } from '../../clients/transports/http.js'
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

export type ReadContractParameters<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends ContractFunctionName<
    abi,
    'pure' | 'view'
  > = ContractFunctionName<abi, 'pure' | 'view'>,
  args extends TronContractFunctionArgs<
    abi,
    'pure' | 'view',
    functionName
  > = TronContractFunctionArgs<abi, 'pure' | 'view', functionName>,
  ///
  allFunctionNames = ContractFunctionName<abi, 'pure' | 'view'>,
  abiFunction extends AbiFunction = abi extends Abi
    ? ExtractAbiFunction<abi, functionName, 'pure' | 'view'>
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
  /** The function to call. */
  functionName:
    | allFunctionNames // show all options
    | (functionName extends allFunctionNames ? functionName : never) // infer value
  /**
   * The caller the call runs as — sent as `owner_address`. Accepts an account
   * or any TRON address form; falls back to the Client's `account`. With
   * neither, an {@link AccountNotFoundError} is thrown.
   *
   * A `view` function can branch on `msg.sender` (allowances, per-caller
   * balances, permission-gated views), so the caller changes what the node
   * returns. There is no safe default: the SDK requires the choice to be
   * explicit rather than silently reading as some placeholder account.
   * java-tron requires `owner_address` on `triggerconstantcontract`, so there
   * is no anonymous form to fall back to either.
   */
  account?: TronAccount | AddressInput | undefined
  /**
   * Run the constant call against solidified state on the SolidityNode
   * instead of the FullNode's latest state. Solidified state trails the chain
   * head, so a write made moments ago is not reflected in the result yet.
   * @default false
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

export type ReadContractReturnType<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends ContractFunctionName<
    abi,
    'pure' | 'view'
  > = ContractFunctionName<abi, 'pure' | 'view'>,
  args extends TronContractFunctionArgs<
    abi,
    'pure' | 'view',
    functionName
  > = TronContractFunctionArgs<abi, 'pure' | 'view', functionName>,
> = TronContractFunctionReturnType<abi, 'pure' | 'view', functionName, args>

export type ReadContractErrorType =
  | AccountNotFoundErrorType
  | ContractFunctionRevertedErrorType
  | DecodeAbiParametersErrorType
  | DecodeFunctionResultErrorType
  | EncodeFunctionDataErrorType
  | HexToStringErrorType
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
 * Reads (constant-calls) a contract function via `triggerconstantcontract`
 * without broadcasting a transaction.
 *
 * The calldata is built locally with {@link encodeFunctionData} and sent as the
 * bare `data` field (no `0x`). If the node reports the call reverted
 * (`result.result === false`), the revert payload in `constant_result[0]` is
 * decoded: `Error(string)` → a human-readable reason, `Panic(uint256)` → a
 * panic code — both surfaced as a {@link ContractFunctionRevertedError}.
 * Otherwise `constant_result[0]` is ABI-decoded against the function outputs.
 *
 * The caller (`account`, else the Client's hoisted account) is required — see
 * {@link ReadContractParameters.account}.
 *
 * @example
 * const balance = await readContract(client, {
 *   address: 'T...',
 *   abi: trc20Abi,
 *   functionName: 'balanceOf',
 *   args: ['T...'],
 *   account: 'T...', // the caller the node sees as msg.sender
 * })
 */
export async function readContract<
  const abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi, 'pure' | 'view'>,
  const args extends TronContractFunctionArgs<
    abi,
    'pure' | 'view',
    functionName
  > = TronContractFunctionArgs<abi, 'pure' | 'view', functionName>,
>(
  client: Client,
  parameters: ReadContractParameters<abi, functionName, args>,
): Promise<ReadContractReturnType<abi, functionName, args>> {
  const {
    abi,
    account: caller,
    address,
    args,
    confirmed,
    functionName,
  } = parameters as ReadContractParameters

  // Resolve the caller (per-call, else hoisted on the Client). Never defaulted:
  // the result of a `view` can depend on who asks.
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
    },
  })

  // java-tron signals a failed constant call by setting `message` — on a REVERT
  // it leaves `result: true`, and proto3 omits the `result: false` default
  // anyway, so keying off `result === false` alone never fires against a real
  // node and the revert payload would decode as if it were the return value.
  // TronWeb keys off `message` for the same reason; `result === false` is kept
  // for nodes and mocks that do emit it.
  if (response?.result?.message || response?.result?.result === false)
    throw decodeRevert(response.constant_result?.[0], response.result.message, {
      functionName,
    })

  const constantResult = response?.constant_result?.[0] ?? ''
  return decodeFunctionResult({
    abi,
    functionName,
    args,
    data: `0x${constantResult}`,
  }) as ReadContractReturnType<abi, functionName, args>
}
