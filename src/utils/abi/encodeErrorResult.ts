// TRON-specific, clean-room implementation for @tronweb3/tviem.
import type { Abi } from 'abitype'

import {
  AbiErrorInputsNotFoundError,
  type AbiErrorInputsNotFoundErrorType,
  AbiErrorNotFoundError,
  type AbiErrorNotFoundErrorType,
} from '../../errors/abi.js'
import type { ErrorType } from '../../errors/utils.js'
import type {
  ContractErrorArgs,
  ContractErrorName,
} from '../../types/contract.js'
import type { Hex } from '../../types/misc.js'
import { type ConcatHexErrorType, concatHex } from '../data/concat.js'
import {
  type ToFunctionSelectorErrorType,
  toFunctionSelector,
} from '../hash/toFunctionSelector.js'
import {
  type EncodeAbiParametersErrorType,
  encodeAbiParameters,
} from './encodeAbiParameters.js'
import { type FormatAbiItemErrorType, formatAbiItem } from './formatAbiItem.js'
import { type GetAbiItemErrorType, getAbiItem } from './getAbiItem.js'

const docsPath = '/docs/contract/encodeErrorResult'

export type EncodeErrorResultParameters<
  abi extends Abi | readonly unknown[] = Abi,
  errorName extends ContractErrorName<abi> | undefined = undefined,
> = {
  abi: abi
  errorName?: errorName | ContractErrorName<abi> | undefined
  args?:
    | ContractErrorArgs<
        abi,
        errorName extends ContractErrorName<abi>
          ? errorName
          : ContractErrorName<abi>
      >
    | readonly unknown[]
    | undefined
}

export type EncodeErrorResultReturnType = Hex

export type EncodeErrorResultErrorType =
  | AbiErrorInputsNotFoundErrorType
  | AbiErrorNotFoundErrorType
  | ConcatHexErrorType
  | EncodeAbiParametersErrorType
  | FormatAbiItemErrorType
  | GetAbiItemErrorType
  | ToFunctionSelectorErrorType
  | ErrorType

/**
 * Encodes a contract revert: the 4-byte selector of the resolved `error` item
 * followed by its ABI-encoded `args` (matching what a contract emits on
 * `revert MyError(...)`). Pass `errorName` to pick the error when the ABI holds
 * more than one. TRON `address` arguments accept any address form and
 * `trcToken` arguments encode like `uint256`.
 *
 * @example
 * encodeErrorResult({
 *   abi: [{ type: 'error', name: 'InsufficientBalance', inputs: [{ type: 'uint256' }] }],
 *   errorName: 'InsufficientBalance',
 *   args: [1n],
 * })
 * // '0x926653510000000000000000000000000000000000000000000000000000000000000001'
 */
export function encodeErrorResult<
  const abi extends Abi | readonly unknown[],
  errorName extends ContractErrorName<abi> | undefined = undefined,
>(
  parameters: EncodeErrorResultParameters<abi, errorName>,
): EncodeErrorResultReturnType {
  const { abi, errorName, args } = parameters as {
    abi: Abi
    errorName?: string
    args?: readonly unknown[]
  }

  let abiItem = abi[0]
  if (errorName) {
    const item = getAbiItem({ abi, args, name: errorName })
    if (!item) throw new AbiErrorNotFoundError(errorName, { docsPath })
    abiItem = item
  }

  if (!abiItem) throw new AbiErrorNotFoundError(undefined, { docsPath })
  if (abiItem.type !== 'error')
    throw new AbiErrorNotFoundError(undefined, { docsPath })

  const signature = toFunctionSelector(formatAbiItem(abiItem))

  let data: Hex = '0x'
  if (args && args.length > 0) {
    if (!abiItem.inputs)
      throw new AbiErrorInputsNotFoundError(abiItem.name, { docsPath })
    data = encodeAbiParameters(abiItem.inputs, args)
  }

  return concatHex([signature, data])
}
