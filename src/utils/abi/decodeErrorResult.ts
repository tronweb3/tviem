// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { Abi, AbiError } from 'abitype'
import { solidityError, solidityPanic } from '../../constants/solidity.js'
import {
  AbiDecodingZeroDataError,
  type AbiDecodingZeroDataErrorType,
  AbiErrorSignatureNotFoundError,
  type AbiErrorSignatureNotFoundErrorType,
} from '../../errors/abi.js'
import type { ErrorType } from '../../errors/utils.js'
import type { ContractErrorName } from '../../types/contract.js'
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
import { type FormatAbiItemErrorType, formatAbiItem } from './formatAbiItem.js'

const docsPath = '/docs/contract/decodeErrorResult'

export type DecodeErrorResultParameters<
  abi extends Abi | readonly unknown[] = Abi,
> = {
  abi?: abi | undefined
  data: Hex
}

export type DecodeErrorResultReturnType<
  abi extends Abi | readonly unknown[] = Abi,
> = {
  abiItem: AbiError
  args: readonly unknown[] | undefined
  errorName: abi extends Abi
    ? Abi extends abi
      ? string
      : ContractErrorName<abi> | 'Error' | 'Panic'
    : string
}

export type DecodeErrorResultErrorType =
  | AbiDecodingZeroDataErrorType
  | AbiErrorSignatureNotFoundErrorType
  | DecodeAbiParametersErrorType
  | FormatAbiItemErrorType
  | SliceErrorType
  | ToFunctionSelectorErrorType
  | ErrorType

/**
 * Decodes a contract revert back into `{ errorName, args, abiItem }`: the
 * leading 4-byte selector resolves the `error` on the ABI, then the trailing
 * bytes decode against its `inputs`. The built-in `Error(string)` and
 * `Panic(uint256)` reverts are always recognised without being on the ABI.
 * TRON `address` arguments decode to the canonical Base58Check form.
 *
 * @example
 * decodeErrorResult({
 *   data: '0x08c379a0…', // Error("reverted")
 * })
 * // { abiItem: {…}, args: ['reverted'], errorName: 'Error' }
 */
export function decodeErrorResult<
  const abi extends Abi | readonly unknown[] = Abi,
>(
  parameters: DecodeErrorResultParameters<abi>,
): DecodeErrorResultReturnType<abi> {
  const { abi, data } = parameters as { abi?: Abi; data: Hex }

  const signature = slice(data, 0, 4)
  if (signature === '0x') throw new AbiDecodingZeroDataError()

  const abi_ = [...(abi ?? []), solidityError, solidityPanic] as readonly (
    | Abi[number]
    | AbiError
  )[]
  const abiItem = abi_.find(
    (x) =>
      x.type === 'error' && signature === toFunctionSelector(formatAbiItem(x)),
  ) as AbiError | undefined
  if (!abiItem)
    throw new AbiErrorSignatureNotFoundError(signature, { docsPath })

  return {
    abiItem,
    args:
      abiItem.inputs && abiItem.inputs.length > 0
        ? decodeAbiParameters(abiItem.inputs, slice(data, 4))
        : undefined,
    errorName: abiItem.name,
  } as DecodeErrorResultReturnType<abi>
}
