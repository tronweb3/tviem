// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { Abi } from 'abitype'

import type { AbiFunctionNotFoundErrorType } from '../../errors/abi.js'
import type { ErrorType } from '../../errors/utils.js'
import type {
  ContractFunctionArgs,
  ContractFunctionName,
} from '../../types/contract.js'
import type { Hex } from '../../types/misc.js'
import type { UnionEvaluate } from '../../types/utils.js'
import { type ConcatHexErrorType, concatHex } from '../data/concat.js'
import { type IsHexErrorType, isHex } from '../data/isHex.js'
import {
  type EncodeAbiParametersErrorType,
  encodeAbiParameters,
} from './encodeAbiParameters.js'
import {
  type PrepareEncodeFunctionDataErrorType,
  prepareEncodeFunctionData,
} from './prepareEncodeFunctionData.js'

export type EncodeFunctionDataParameters<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends
    | ContractFunctionName<abi>
    | undefined = ContractFunctionName<abi>,
  //
  hasFunctions = abi extends Abi
    ? Abi extends abi
      ? true
      : [ExtractAbiFunctions<abi>] extends [never]
        ? false
        : true
    : true,
  allArgs = ContractFunctionArgs<
    abi,
    'nonpayable' | 'payable' | 'pure' | 'view',
    functionName extends ContractFunctionName<abi>
      ? functionName
      : ContractFunctionName<abi>
  >,
  allFunctionNames = ContractFunctionName<abi>,
> = {
  abi: abi
  args?: allArgs | readonly unknown[] | undefined
} & UnionEvaluate<
  hasFunctions extends true
    ? {
        functionName?:
          | allFunctionNames
          | (functionName extends allFunctionNames ? functionName : never)
          | Hex
          | undefined
      }
    : { functionName?: undefined }
>

type ExtractAbiFunctions<abi extends Abi> = Extract<
  abi[number],
  { type: 'function' }
>

export type EncodeFunctionDataReturnType = Hex

export type EncodeFunctionDataErrorType =
  | AbiFunctionNotFoundErrorType
  | ConcatHexErrorType
  | EncodeAbiParametersErrorType
  | IsHexErrorType
  | PrepareEncodeFunctionDataErrorType
  | ErrorType

/**
 * Encodes a function call into ABI-encoded calldata: the 4-byte selector
 * (`toFunctionSelector` of the resolved item's signature) followed by
 * `encodeAbiParameters(inputs, args)`. TRON `address` arguments accept any
 * form and `trcToken` arguments encode like `uint256`.
 *
 * Pass the output of {@link prepareEncodeFunctionData} (an `abi` of one item
 * plus a hex `functionName`) to skip re-resolving the selector.
 *
 * @example
 * encodeFunctionData({
 *   abi: erc20Abi,
 *   functionName: 'transfer',
 *   args: ['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 1000000n],
 * })
 * // '0xa9059cbb…'
 */
export function encodeFunctionData<
  const abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi> | undefined = undefined,
>(
  parameters: EncodeFunctionDataParameters<abi, functionName>,
): EncodeFunctionDataReturnType {
  const { args } = parameters as {
    args?: readonly unknown[]
  }
  const { abi, functionName } = (() => {
    // Already-prepared: single-item abi + hex selector.
    if (
      parameters.abi.length === 1 &&
      (parameters as { functionName?: string }).functionName &&
      isHex((parameters as { functionName?: string }).functionName)
    )
      return parameters as { abi: Abi; functionName: Hex }
    return prepareEncodeFunctionData(
      parameters as Parameters<typeof prepareEncodeFunctionData>[0],
    ) as { abi: Abi; functionName: Hex }
  })()

  const abiItem = abi[0]!
  const signature = functionName
  const data =
    'inputs' in abiItem && abiItem.inputs
      ? encodeAbiParameters(abiItem.inputs, args ?? [])
      : undefined
  return concatHex([signature, data ?? '0x'])
}
