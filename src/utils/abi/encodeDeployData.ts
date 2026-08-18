import type { Abi } from 'abitype'

import {
  AbiConstructorNotFoundError,
  type AbiConstructorNotFoundErrorType,
  AbiConstructorParamsNotFoundError,
  type AbiConstructorParamsNotFoundErrorType,
} from '../../errors/abi.js'
import type { ErrorType } from '../../errors/utils.js'
import type { ContractConstructorArgs } from '../../types/contract.js'
import type { Hex } from '../../types/misc.js'
import { type ConcatHexErrorType, concatHex } from '../data/concat.js'
import {
  type EncodeAbiParametersErrorType,
  encodeAbiParameters,
} from './encodeAbiParameters.js'

const docsPath = '/docs/contract/encodeDeployData'

export type EncodeDeployDataParameters<
  abi extends Abi | readonly unknown[] = Abi,
> = {
  abi: abi
  bytecode: Hex
  args?: ContractConstructorArgs<abi> | readonly unknown[] | undefined
}

export type EncodeDeployDataReturnType = Hex

export type EncodeDeployDataErrorType =
  | AbiConstructorNotFoundErrorType
  | AbiConstructorParamsNotFoundErrorType
  | ConcatHexErrorType
  | EncodeAbiParametersErrorType
  | ErrorType

/**
 * Encodes contract-creation calldata: the creation `bytecode` followed by the
 * ABI-encoded constructor `args` (or the bytecode unchanged when the
 * constructor takes no arguments). Throws when the constructor declares inputs
 * but `args` are missing or mismatched in length. TRON `address` constructor
 * arguments accept any address form and `trcToken` arguments encode like
 * `uint256`.
 *
 * @example
 * encodeDeployData({
 *   abi: [{ type: 'constructor', inputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' }],
 *   bytecode: '0x6080…',
 *   args: [1000000n],
 * })
 * // '0x6080…00000000000000000000000000000000000000000000000000000000000f4240'
 */
export function encodeDeployData<const abi extends Abi | readonly unknown[]>(
  parameters: EncodeDeployDataParameters<abi>,
): EncodeDeployDataReturnType {
  const { abi, args, bytecode } = parameters as {
    abi: Abi
    args?: readonly unknown[]
    bytecode: Hex
  }

  const description = abi.find((x) => x.type === 'constructor')

  if (!description) {
    if (!args || args.length === 0) return bytecode
    throw new AbiConstructorNotFoundError({ docsPath })
  }
  if (
    !('inputs' in description) ||
    !description.inputs ||
    description.inputs.length === 0
  ) {
    if (!args || args.length === 0) return bytecode
    throw new AbiConstructorParamsNotFoundError({ docsPath })
  }

  const data = encodeAbiParameters(description.inputs, args ?? [])
  return concatHex([bytecode, data])
}
