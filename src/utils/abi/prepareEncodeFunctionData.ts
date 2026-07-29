// TRON-specific, clean-room implementation for @tronweb3/tviem.
import type { Abi } from 'abitype'

import {
  AbiFunctionNotFoundError,
  type AbiFunctionNotFoundErrorType,
} from '../../errors/abi.js'
import type { ErrorType } from '../../errors/utils.js'
import type {
  ContractFunctionArgs,
  ContractFunctionName,
} from '../../types/contract.js'
import type { Hex } from '../../types/misc.js'
import type { IsNarrowable, UnionEvaluate } from '../../types/utils.js'
import {
  type ToFunctionSelectorErrorType,
  toFunctionSelector,
} from '../hash/toFunctionSelector.js'
import { formatAbiItem } from './formatAbiItem.js'
import { type GetAbiItemErrorType, getAbiItem } from './getAbiItem.js'

export type PrepareEncodeFunctionDataParameters<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends
    | ContractFunctionName<abi>
    | undefined = ContractFunctionName<abi>,
  args extends ContractFunctionArgs<
    abi,
    'nonpayable' | 'payable' | 'pure' | 'view',
    functionName extends ContractFunctionName<abi>
      ? functionName
      : ContractFunctionName<abi>
  > = ContractFunctionArgs<
    abi,
    'nonpayable' | 'payable' | 'pure' | 'view',
    functionName extends ContractFunctionName<abi>
      ? functionName
      : ContractFunctionName<abi>
  >,
> = {
  abi: abi
  functionName?: functionName | ContractFunctionName<abi> | undefined
  args?: args | readonly unknown[] | undefined
}

export type PrepareEncodeFunctionDataReturnType<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends
    | ContractFunctionName<abi>
    | undefined = ContractFunctionName<abi>,
> = UnionEvaluate<{
  abi: IsNarrowable<abi, Abi> extends true
    ? readonly [ExtractAbiFunctionForName<abi, functionName>]
    : abi
  functionName: Hex
}>

type ExtractAbiFunctionForName<
  abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi> | undefined,
> = abi extends Abi
  ? functionName extends ContractFunctionName<abi>
    ? Extract<abi[number], { type: 'function'; name: functionName }>
    : abi[number]
  : abi extends readonly unknown[]
    ? abi[number]
    : never

export type PrepareEncodeFunctionDataErrorType =
  | AbiFunctionNotFoundErrorType
  | GetAbiItemErrorType
  | ToFunctionSelectorErrorType
  | ErrorType

/**
 * Precomputes the function selector and resolved ABI item for
 * {@link encodeFunctionData}, so the selector is derived (and any overload
 * disambiguated) once and reused across many encode calls.
 *
 * The selector is `toFunctionSelector` of the resolved item's signature; the
 * signature keeps `trcToken` verbatim (e.g. `transferToken(address,trcToken,
 * uint256)`), so TRON-native functions hash to their on-chain selector.
 *
 * @example
 * const { abi, functionName } = prepareEncodeFunctionData({
 *   abi: erc20Abi,
 *   functionName: 'transfer',
 * })
 * encodeFunctionData({ abi, functionName, args })
 */
export function prepareEncodeFunctionData<
  const abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi> | undefined = undefined,
>(
  parameters: PrepareEncodeFunctionDataParameters<abi, functionName>,
): PrepareEncodeFunctionDataReturnType<abi, functionName> {
  const { abi, args, functionName } = parameters as {
    abi: Abi
    args?: readonly unknown[]
    functionName?: string
  }

  let abiItem = abi[0]
  if (functionName) {
    const item = getAbiItem({ abi, args, name: functionName })
    if (!item)
      throw new AbiFunctionNotFoundError(functionName, {
        docsPath: '/docs/contract/encodeFunctionData',
      })
    abiItem = item
  }

  if (!abiItem)
    throw new AbiFunctionNotFoundError(undefined, {
      docsPath: '/docs/contract/encodeFunctionData',
    })
  if (abiItem.type !== 'function')
    throw new AbiFunctionNotFoundError(undefined, {
      docsPath: '/docs/contract/encodeFunctionData',
    })

  return {
    abi: [abiItem],
    functionName: toFunctionSelector(formatAbiItem(abiItem)),
  } as PrepareEncodeFunctionDataReturnType<abi, functionName>
}
