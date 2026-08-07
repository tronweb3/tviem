import type { Abi } from 'abitype'

import {
  AbiDecodingDataSizeInvalidError,
  type AbiDecodingDataSizeInvalidErrorType,
  AbiFunctionNotFoundError,
  type AbiFunctionNotFoundErrorType,
  AbiFunctionOutputsNotFoundError,
  type AbiFunctionOutputsNotFoundErrorType,
} from '../../errors/abi.js'
import type { ErrorType } from '../../errors/utils.js'
import type {
  ContractFunctionArgs,
  ContractFunctionName,
  ExtractAbiFunctionForArgs,
} from '../../types/contract.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import { bytesToHex } from '../encoding/toHex.js'
import {
  type DecodeAbiParametersErrorType,
  decodeAbiParameters,
} from './decodeAbiParameters.js'
import type { TronAbiParametersToPrimitiveTypes } from './encodeAbiParameters.js'
import { type GetAbiItemErrorType, getAbiItem } from './getAbiItem.js'

const docsPath = '/docs/contract/decodeFunctionResult'

export type DecodeFunctionResultParameters<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends ContractFunctionName<abi> | undefined =
    | ContractFunctionName<abi>
    | undefined,
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
  args?: args | readonly unknown[] | undefined
  functionName?: functionName | ContractFunctionName<abi> | undefined
  data: Hex | ByteArray
}

export type DecodeFunctionResultReturnType<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends ContractFunctionName<abi> | undefined =
    | ContractFunctionName<abi>
    | undefined,
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
> = abi extends Abi
  ? Abi extends abi
    ? unknown
    : TronAbiParametersToPrimitiveTypes<
          ExtractAbiFunctionForArgs<
            abi,
            'nonpayable' | 'payable' | 'pure' | 'view',
            functionName extends ContractFunctionName<abi>
              ? functionName
              : ContractFunctionName<abi>,
            args
          >['outputs'],
          'outputs'
        > extends infer types
      ? types extends readonly []
        ? void
        : types extends readonly [infer type]
          ? type
          : types
      : never
  : unknown

export type DecodeFunctionResultErrorType =
  | AbiDecodingDataSizeInvalidErrorType
  | AbiFunctionNotFoundErrorType
  | AbiFunctionOutputsNotFoundErrorType
  | DecodeAbiParametersErrorType
  | GetAbiItemErrorType
  | ErrorType

/**
 * Decodes the raw return data of a function call against its ABI `outputs`:
 * no outputs → `undefined`, a single output unwraps to that value, multiple
 * outputs return a positional tuple. TRON `address` outputs decode to the
 * canonical Base58Check form and `trcToken` outputs decode like `uint256`.
 *
 * @example
 * decodeFunctionResult({
 *   abi: erc20Abi,
 *   functionName: 'balanceOf',
 *   data: '0x000000000000000000000000000000000000000000661efdf12d1653cf340000',
 * })
 * // 123456789000000000000000000n
 */
export function decodeFunctionResult<
  const abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi> | undefined = undefined,
  const args extends ContractFunctionArgs<
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
>(
  parameters: DecodeFunctionResultParameters<abi, functionName, args>,
): DecodeFunctionResultReturnType<abi, functionName, args> {
  const { abi, args, functionName, data } = parameters as {
    abi: Abi
    args?: readonly unknown[]
    functionName?: string
    data: Hex | ByteArray
  }

  let abiItem = abi[0]
  if (functionName) {
    const item = getAbiItem({ abi, args, name: functionName })
    if (!item) throw new AbiFunctionNotFoundError(functionName, { docsPath })
    abiItem = item
  }

  if (!abiItem) throw new AbiFunctionNotFoundError(undefined, { docsPath })
  if (abiItem.type !== 'function')
    throw new AbiFunctionNotFoundError(undefined, { docsPath })
  if (!abiItem.outputs)
    throw new AbiFunctionOutputsNotFoundError(abiItem.name, { docsPath })

  // Return data (`constant_result` from a node) is always a whole number of
  // 32-byte words — a calldata-style TIP-2771 suffix cannot occur here — so a
  // misaligned payload is a lossy/corrupt node response, not something to
  // decode a partial word from. The generic decoder tolerates trailing bytes
  // for the calldata paths, so alignment is enforced at this boundary. An
  // odd-nibble hex string is left for decodeAbiParameters to reject as
  // invalid hex rather than being miscounted here.
  const size =
    typeof data === 'string'
      ? data.length % 2 === 0
        ? Math.max(0, (data.length - 2) / 2)
        : undefined
      : data.length
  if (size !== undefined && size % 32 !== 0)
    throw new AbiDecodingDataSizeInvalidError({
      data: typeof data === 'string' ? data : bytesToHex(data),
      size,
    })

  const values = decodeAbiParameters(abiItem.outputs, data)
  if (values && values.length > 1)
    return values as DecodeFunctionResultReturnType<abi, functionName, args>
  if (values && values.length === 1)
    return values[0] as DecodeFunctionResultReturnType<abi, functionName, args>
  return undefined as DecodeFunctionResultReturnType<abi, functionName, args>
}
