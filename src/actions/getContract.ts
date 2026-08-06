import type {
  Abi,
  AbiFunction,
  ExtractAbiEventNames,
  ExtractAbiFunction,
  ExtractAbiFunctionNames,
} from 'abitype'

import type { Client } from '../clients/createClient.js'
import type { ErrorType } from '../errors/utils.js'
import type { Address } from '../types/address.js'
import type { ContractFunctionName } from '../types/contract.js'
import type { IsNever, Prettify } from '../types/utils.js'
import type { TronAbiParametersToPrimitiveTypes } from '../utils/abi/encodeAbiParameters.js'
import { getAction } from '../utils/getAction.js'
import {
  type EstimateEnergyParameters,
  estimateEnergy,
} from './public/estimateEnergy.js'
import {
  type GetContractEventsParameters,
  type GetContractEventsReturnType,
  getContractEvents,
} from './public/getContractEvents.js'
import {
  type ReadContractParameters,
  readContract,
} from './public/readContract.js'
import {
  type WriteContractParameters,
  type WriteContractReturnType,
  writeContract,
} from './wallet/writeContract.js'

export type GetContractParameters<
  abi extends Abi | readonly unknown[] = Abi,
  address extends Address = Address,
  client extends Client = Client,
> = {
  /** The contract ABI. */
  abi: abi
  /** The contract's Base58Check address. */
  address: address
  /**
   * The Client.
   *
   * A Public Client (with `readContract`) enables `read`; a Wallet Client (with
   * `writeContract`) enables `write` and `estimateEnergy`. A Client extended
   * with both action sets enables all groups.
   */
  client: client
}

/** The `read.<fn>` per-call options: {@link ReadContractParameters} minus the
 * facade-supplied fields. */
type ReadOptions = Prettify<
  Omit<ReadContractParameters, 'abi' | 'address' | 'functionName' | 'args'>
>
/** The `write.<fn>` per-call options: {@link WriteContractParameters} minus the
 * facade-supplied fields. */
type WriteOptions = Prettify<
  Omit<WriteContractParameters, 'abi' | 'address' | 'functionName' | 'args'>
>
/** The `estimateEnergy.<fn>` per-call options. */
type EstimateOptions = Prettify<
  Omit<EstimateEnergyParameters, 'abi' | 'address' | 'functionName' | 'args'>
>

/** ABI input args in TRON flavor: `address` positions accept any TRON form
 * (Base58 `T…`, `41…` hex, `0x…` EVM); integers accept `bigint | number`. */
type TronArgs<abiFunction extends AbiFunction> =
  TronAbiParametersToPrimitiveTypes<abiFunction['inputs'], 'inputs'>

/** Collapses a mapped outputs tuple like the decode layer: `[]` → `void`,
 * `[x]` → `x`, otherwise the tuple. */
type CollapseOutputs<outputs> = outputs extends readonly []
  ? void
  : outputs extends readonly [infer output]
    ? output
    : outputs

/** ABI outputs in TRON flavor: `address` positions brand out to Base58
 * `Address`; integers to `bigint`. */
type TronReturn<abiFunction extends AbiFunction> = CollapseOutputs<
  TronAbiParametersToPrimitiveTypes<abiFunction['outputs'], 'outputs'>
>

type GetReadFunction<
  abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi, 'pure' | 'view'>,
  abiFunction extends AbiFunction = abi extends Abi
    ? ExtractAbiFunction<abi, functionName, 'pure' | 'view'>
    : AbiFunction,
  _args = TronArgs<abiFunction>,
> = (
  ...parameters: _args extends readonly []
    ? [options?: ReadOptions]
    : [args: _args, options?: ReadOptions]
) => Promise<TronReturn<abiFunction>>

type GetWriteFunction<
  abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'>,
  abiFunction extends AbiFunction = abi extends Abi
    ? ExtractAbiFunction<abi, functionName, 'nonpayable' | 'payable'>
    : AbiFunction,
  _args = TronArgs<abiFunction>,
> = (
  ...parameters: _args extends readonly []
    ? [options?: WriteOptions]
    : [args: _args, options?: WriteOptions]
) => Promise<WriteContractReturnType>

type GetEstimateFunction<
  abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'>,
  abiFunction extends AbiFunction = abi extends Abi
    ? ExtractAbiFunction<abi, functionName, 'nonpayable' | 'payable'>
    : AbiFunction,
  _args = TronArgs<abiFunction>,
> = (
  ...parameters: _args extends readonly []
    ? [options?: EstimateOptions]
    : [args: _args, options?: EstimateOptions]
) => Promise<bigint>

/** Facade `getEvents.<Event>(options?)` filters — everything `getContractEvents`
 * takes except `abi` / `address` / `eventName` (which the facade binds). */
export type GetEventsOptions = Omit<
  GetContractEventsParameters,
  'abi' | 'address' | 'eventName'
>

/** `getEvents.<Event>(options?)` → the events matching that event name. */
type GetEventsGroup<_eventNames extends string> =
  IsNever<_eventNames> extends true
    ? {
        [eventName: string]: (
          options?: GetEventsOptions,
        ) => Promise<GetContractEventsReturnType>
      }
    : {
        [eventName in _eventNames]: (
          options?: GetEventsOptions,
        ) => Promise<GetContractEventsReturnType>
      }

export type GetContractReturnType<
  abi extends Abi | readonly unknown[] = Abi,
  client extends Client = Client,
  address extends Address = Address,
  _readNames extends string = abi extends Abi
    ? Abi extends abi
      ? string
      : ExtractAbiFunctionNames<abi, 'pure' | 'view'>
    : string,
  _writeNames extends string = abi extends Abi
    ? Abi extends abi
      ? string
      : ExtractAbiFunctionNames<abi, 'nonpayable' | 'payable'>
    : string,
  _eventNames extends string = abi extends Abi
    ? Abi extends abi
      ? string
      : ExtractAbiEventNames<abi>
    : string,
  _hasRead = client extends { readContract: (...args: never) => unknown }
    ? true
    : false,
  _hasWrite = client extends { writeContract: (...args: never) => unknown }
    ? true
    : false,
> = Prettify<
  {
    abi: abi
    address: address
    getEvents: GetEventsGroup<_eventNames>
  } & (_hasRead extends true
    ? IsNever<_readNames> extends true
      ? unknown
      : {
          /**
           * Calls a read-only (`view` / `pure`) contract function via
           * `readContract` and returns the decoded result.
           */
          read: {
            [functionName in _readNames]: GetReadFunction<
              abi,
              functionName extends ContractFunctionName<abi, 'pure' | 'view'>
                ? functionName
                : never
            >
          }
        }
    : unknown) &
    (_hasWrite extends true
      ? IsNever<_writeNames> extends true
        ? unknown
        : {
            /**
             * Executes a state-changing (`nonpayable` / `payable`) contract
             * function via `writeContract` (local build → sign → broadcast).
             */
            write: {
              [functionName in _writeNames]: GetWriteFunction<
                abi,
                functionName extends ContractFunctionName<
                  abi,
                  'nonpayable' | 'payable'
                >
                  ? functionName
                  : never
              >
            }
            /**
             * Estimates the energy a state-changing contract function would
             * consume, via `estimateEnergy`.
             */
            estimateEnergy: {
              [functionName in _writeNames]: GetEstimateFunction<
                abi,
                functionName extends ContractFunctionName<
                  abi,
                  'nonpayable' | 'payable'
                >
                  ? functionName
                  : never
              >
            }
          }
      : unknown)
>

export type GetContractErrorType = ErrorType

/**
 * Builds a type-safe façade over a contract's `abi` and `address` so contract
 * actions can be invoked without re-passing them each call.
 *
 * Functions are grouped by `stateMutability`: `view` / `pure` → `read` (backed
 * by `readContract`); `nonpayable` / `payable` → `write` (backed by
 * `writeContract`) and `estimateEnergy`. Groups are mounted by capability
 * probing the Client — `read` only when it exposes `readContract`, `write` /
 * `estimateEnergy` only when it exposes `writeContract`. `getEvents.<Event>` is
 * always mounted and reads that event's logs via `getContractEvents`.
 *
 * @example
 * const contract = getContract({
 *   address: 'TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLe',
 *   abi: trc20Abi,
 *   client: publicClient,
 * })
 * const balance = await contract.read.balanceOf(['TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'])
 */
export function getContract<
  const abi extends Abi | readonly unknown[],
  const address extends Address,
  const client extends Client,
>(
  parameters: GetContractParameters<abi, address, client>,
): GetContractReturnType<abi, client, address> {
  const { abi, address, client } = parameters as {
    abi: Abi
    address: Address
    client: Client & Record<string, unknown>
  }

  const hasRead = 'readContract' in client
  const hasWrite = 'writeContract' in client

  let hasReadFunction = false
  let hasWriteFunction = false
  for (const item of abi) {
    if (item.type === 'function') {
      if (item.stateMutability === 'view' || item.stateMutability === 'pure')
        hasReadFunction = true
      else hasWriteFunction = true
    }
    // Exit early once both groups are known to be present.
    if (hasReadFunction && hasWriteFunction) break
  }

  const contract: Record<string, unknown> = { abi, address }

  if (hasRead && hasReadFunction)
    contract.read = new Proxy(
      {},
      {
        get(_, functionName: string) {
          return (
            ...parameters: [
              args?: readonly unknown[] | undefined,
              options?: ReadOptions | undefined,
            ]
          ) => {
            const { args, options } = getFunctionParameters(parameters)
            return getAction(
              client,
              readContract,
              'readContract',
            )({
              abi,
              address,
              functionName,
              args,
              ...options,
            } as ReadContractParameters)
          }
        },
      },
    )

  if (hasWrite && hasWriteFunction) {
    contract.write = new Proxy(
      {},
      {
        get(_, functionName: string) {
          return (
            ...parameters: [
              args?: readonly unknown[] | undefined,
              options?: WriteOptions | undefined,
            ]
          ) => {
            const { args, options } = getFunctionParameters(parameters)
            return getAction(
              client,
              writeContract,
              'writeContract',
            )({
              abi,
              address,
              functionName,
              args,
              ...options,
            } as WriteContractParameters)
          }
        },
      },
    )

    contract.estimateEnergy = new Proxy(
      {},
      {
        get(_, functionName: string) {
          return (
            ...parameters: [
              args?: readonly unknown[] | undefined,
              options?: EstimateOptions | undefined,
            ]
          ) => {
            const { args, options } = getFunctionParameters(parameters)
            return getAction(
              client,
              estimateEnergy,
              'estimateEnergy',
            )({
              abi,
              address,
              functionName,
              args,
              ...options,
            } as EstimateEnergyParameters)
          }
        },
      },
    )
  }

  contract.getEvents = new Proxy(
    {},
    {
      get(_, eventName: string) {
        return (options?: GetEventsOptions) =>
          getAction(
            client,
            getContractEvents,
            'getContractEvents',
          )({
            abi,
            address,
            eventName,
            ...options,
          } as GetContractEventsParameters)
      },
    },
  )

  return contract as unknown as GetContractReturnType<abi, client, address>
}

/**
 * Splits a facade call's variadic tuple into `{ args, options }`. When the
 * first value is an array it is the function `args` (and the second is
 * `options`); otherwise the first value is `options` and there are no `args`.
 *
 * @internal exported for testing only
 */
export function getFunctionParameters(
  values: [
    argsOrOptions?: readonly unknown[] | object | undefined,
    options?: object | undefined,
  ],
): { args: readonly unknown[]; options: object } {
  const hasArgs = values.length > 0 && Array.isArray(values[0])
  const args = hasArgs ? (values[0] as readonly unknown[]) : []
  const options = ((hasArgs ? values[1] : values[0]) ?? {}) as object
  return { args, options }
}
