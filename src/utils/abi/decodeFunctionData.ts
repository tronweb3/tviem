import type { Abi, AbiFunction, ExtractAbiFunction } from 'abitype'

import {
  AbiFunctionSignatureNotFoundError,
  type AbiFunctionSignatureNotFoundErrorType,
} from '../../errors/abi.js'
import type { ErrorType } from '../../errors/utils.js'
import type { ContractFunctionName } from '../../types/contract.js'
import type { Hex } from '../../types/misc.js'
import { type SliceErrorType, slice } from '../data/slice.js'
import {
  type ToFunctionSelectorErrorType,
  toFunctionSelector,
} from '../hash/toFunctionSelector.js'
import {
  type DecodeAbiParametersErrorType,
  decodeAbiParameters,
} from './decodeAbiParameters.js'
import type { TronAbiParametersToPrimitiveTypes } from './encodeAbiParameters.js'
import { type FormatAbiItemErrorType, formatAbiItem } from './formatAbiItem.js'

export type DecodeFunctionDataParameters<
  abi extends Abi | readonly unknown[] = Abi,
> = {
  abi: abi
  data: Hex
}

type LooseDecodeFunctionDataReturnType = {
  args: readonly unknown[] | undefined
  functionName: string
}

export type DecodeFunctionDataReturnType<
  abi extends Abi | readonly unknown[] = Abi,
> = abi extends Abi
  ? Abi extends abi
    ? LooseDecodeFunctionDataReturnType
    : {
        [functionName in ContractFunctionName<abi>]: {
          args: TronAbiParametersToPrimitiveTypes<
            ExtractAbiFunction<abi, functionName>['inputs'],
            'outputs'
          > extends infer args extends readonly unknown[]
            ? args extends readonly []
              ? undefined
              : args
            : undefined
          functionName: functionName
        }
      }[ContractFunctionName<abi>]
  : LooseDecodeFunctionDataReturnType

export type DecodeFunctionDataErrorType =
  | AbiFunctionSignatureNotFoundErrorType
  | DecodeAbiParametersErrorType
  | FormatAbiItemErrorType
  | SliceErrorType
  | ToFunctionSelectorErrorType
  | ErrorType

const docsPath = '/docs/contract/decodeFunctionData'

/**
 * Decodes ABI-encoded calldata back into its `{ functionName, args }`: the
 * leading 4-byte selector resolves the function on the ABI, then the trailing
 * bytes decode against its `inputs` (or `args` is `undefined` for a
 * no-argument function). TRON `address` arguments decode to the canonical
 * Base58Check form and `trcToken` arguments decode like `uint256`.
 *
 * @example
 * decodeFunctionData({
 *   abi: erc20Abi,
 *   data: '0xa9059cbb…',
 * })
 * // { functionName: 'transfer', args: ['TR7…', 1000000n] }
 */
export function decodeFunctionData<const abi extends Abi | readonly unknown[]>(
  parameters: DecodeFunctionDataParameters<abi>,
): DecodeFunctionDataReturnType<abi> {
  const { abi, data } = parameters as { abi: Abi; data: Hex }

  const signature = slice(data, 0, 4)
  const description = abi.find(
    (x) =>
      x.type === 'function' &&
      signature === toFunctionSelector(formatAbiItem(x)),
  ) as AbiFunction | undefined
  if (!description)
    throw new AbiFunctionSignatureNotFoundError(signature, { docsPath })

  return {
    functionName: description.name,
    args:
      description.inputs && description.inputs.length > 0
        ? decodeAbiParameters(description.inputs, slice(data, 4))
        : undefined,
  } as DecodeFunctionDataReturnType<abi>
}
