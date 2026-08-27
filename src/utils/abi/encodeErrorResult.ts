import type { Abi } from 'abitype'

import { solidityError, solidityPanic } from '../../constants/solidity.js'
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

/** `abi` with the built-in `Error(string)` / `Panic(uint256)` reverts appended. */
type WithSolidityErrors<abi extends Abi | readonly unknown[]> = abi extends Abi
  ? readonly [...abi, typeof solidityError, typeof solidityPanic]
  : abi

export type EncodeErrorResultParameters<
  abi extends Abi | readonly unknown[] = Abi,
  errorName extends
    | ContractErrorName<WithSolidityErrors<abi>>
    | undefined = undefined,
> = {
  abi?: abi | undefined
  errorName?: errorName | ContractErrorName<WithSolidityErrors<abi>> | undefined
  args?:
    | ContractErrorArgs<
        WithSolidityErrors<abi>,
        errorName extends ContractErrorName<WithSolidityErrors<abi>>
          ? errorName
          : ContractErrorName<WithSolidityErrors<abi>>
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
 * more than one. The built-in `Error(string)` and `Panic(uint256)` reverts are
 * always encodable without being on the ABI (mirroring `decodeErrorResult`).
 * TRON `address` arguments accept any address form and `trcToken` arguments
 * encode like `uint256`.
 *
 * @example
 * encodeErrorResult({
 *   abi: [{ type: 'error', name: 'InsufficientBalance', inputs: [{ type: 'uint256' }] }],
 *   errorName: 'InsufficientBalance',
 *   args: [1n],
 * })
 * // '0x926653510000000000000000000000000000000000000000000000000000000000000001'
 *
 * @example
 * encodeErrorResult({ errorName: 'Error', args: ['reverted'] })
 * // '0x08c379a0…'
 */
export function encodeErrorResult<
  const abi extends Abi | readonly unknown[] = readonly [],
  errorName extends
    | ContractErrorName<WithSolidityErrors<abi>>
    | undefined = undefined,
>(
  parameters: EncodeErrorResultParameters<abi, errorName>,
): EncodeErrorResultReturnType {
  const { abi, errorName, args } = parameters as {
    abi?: Abi
    errorName?: string
    args?: readonly unknown[]
  }

  let abiItem = abi?.[0]
  if (errorName) {
    // The built-ins are a FALLBACK only: an ABI-declared error with the same
    // name shadows them, matching the precedence decodeErrorResult's
    // first-match lookup gives the user's ABI.
    const item =
      getAbiItem({ abi: abi ?? [], args, name: errorName }) ??
      getAbiItem({
        abi: [solidityError, solidityPanic] as Abi,
        args,
        name: errorName,
      })
    if (!item) throw new AbiErrorNotFoundError(errorName, { docsPath })
    abiItem = item
  }

  if (!abiItem) throw new AbiErrorNotFoundError(undefined, { docsPath })
  if (abiItem.type !== 'error')
    throw new AbiErrorNotFoundError(undefined, { docsPath })

  const signature = toFunctionSelector(formatAbiItem(abiItem))

  let data: Hex = '0x'
  // Encode whenever the error DECLARES inputs, not only when args were given:
  // a required-args error with args omitted would otherwise return the bare
  // selector — a payload the same ABI cannot decode. The length check inside
  // encodeAbiParameters then rejects the mismatch (the same shape
  // encodeDeployData enforces for constructors); zero-input errors still
  // encode to the selector alone.
  if (abiItem.inputs && abiItem.inputs.length > 0) {
    data = encodeAbiParameters(abiItem.inputs, args ?? [])
  } else if (args && args.length > 0) {
    throw new AbiErrorInputsNotFoundError(abiItem.name, { docsPath })
  }

  return concatHex([signature, data])
}
