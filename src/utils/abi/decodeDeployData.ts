import type { Abi } from 'abitype'

import {
  AbiConstructorNotFoundError,
  type AbiConstructorNotFoundErrorType,
  AbiConstructorParamsNotFoundError,
  type AbiConstructorParamsNotFoundErrorType,
} from '../../errors/abi.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Hex } from '../../types/misc.js'
import {
  type DecodeAbiParametersErrorType,
  decodeAbiParameters,
} from './decodeAbiParameters.js'
import type { TronAbiParametersToPrimitiveTypes } from './encodeAbiParameters.js'

const docsPath = '/docs/contract/decodeDeployData'

export type DecodeDeployDataParameters<
  abi extends Abi | readonly unknown[] = Abi,
> = {
  abi: abi
  bytecode: Hex
  data: Hex
}

/** Decoded constructor args in TRON flavor: `address` positions brand out to
 * Base58 `Address`, integers to `bigint`. `readonly unknown[]` when the ABI
 * carries no constructor. */
type TronConstructorArgs<abi extends Abi | readonly unknown[]> =
  TronAbiParametersToPrimitiveTypes<
    Extract<
      (abi extends Abi ? abi : Abi)[number],
      { type: 'constructor' }
    >['inputs'],
    'outputs'
  > extends infer args
    ? [args] extends [never]
      ? readonly unknown[]
      : args
    : readonly unknown[]

export type DecodeDeployDataReturnType<
  abi extends Abi | readonly unknown[] = Abi,
> = {
  args?: TronConstructorArgs<abi> | undefined
  bytecode: Hex
}

export type DecodeDeployDataErrorType =
  | AbiConstructorNotFoundErrorType
  | AbiConstructorParamsNotFoundErrorType
  | DecodeAbiParametersErrorType
  | ErrorType

/**
 * Decodes contract-creation calldata against its constructor ABI: strips the
 * known creation `bytecode` prefix off `data` and decodes the trailing bytes
 * as the constructor arguments. Returns `{ bytecode }` alone when `data`
 * equals `bytecode` (no arguments). TRON `address` arguments decode to the
 * canonical Base58Check form.
 *
 * @example
 * decodeDeployData({
 *   abi: [{ type: 'constructor', inputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' }],
 *   bytecode: '0x6080…',
 *   data: '0x6080…00000000000000000000000000000000000000000000000000000000000f4240',
 * })
 * // { args: [1000000n], bytecode: '0x6080…' }
 */
export function decodeDeployData<const abi extends Abi | readonly unknown[]>(
  parameters: DecodeDeployDataParameters<abi>,
): DecodeDeployDataReturnType<abi> {
  const { abi, bytecode, data } = parameters as {
    abi: Abi
    bytecode: Hex
    data: Hex
  }

  if (data === bytecode) return { bytecode } as DecodeDeployDataReturnType<abi>

  const description = abi.find((x) => x.type === 'constructor')
  if (!description) throw new AbiConstructorNotFoundError({ docsPath })
  if (!('inputs' in description))
    throw new AbiConstructorParamsNotFoundError({ docsPath })
  if (!description.inputs || description.inputs.length === 0)
    throw new AbiConstructorParamsNotFoundError({ docsPath })

  const args = decodeAbiParameters(
    description.inputs,
    `0x${data.replace(bytecode, '')}`,
  )
  return { args, bytecode } as DecodeDeployDataReturnType<abi>
}
