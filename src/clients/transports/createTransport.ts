import type { TronAccount } from '../../accounts/types.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Chain } from '../../types/chain.js'
import type { TronRequestFn } from '../../types/transport.js'
import { buildRequest } from '../../utils/buildRequest.js'
import { uid as uid_ } from '../../utils/uid.js'

export type TransportConfig<type extends string = string> = {
  /** The name of the transport. */
  name: string
  /** The key of the transport. */
  key: string
  /** The normalized transport request function. */
  request: TronRequestFn
  /** The base delay (in ms) between retries. */
  retryDelay?: number | undefined
  /** The max number of times to retry. Defaults to `0` (no retries). */
  retryCount?: number | undefined
  /** The timeout (in ms) for requests. */
  timeout?: number | undefined
  /** The type of the transport. */
  type: type
}

export type Transport<
  type extends string = string,
  rpcAttributes = Record<string, any>,
> = <chain extends Chain | undefined = Chain>(params: {
  account?: TronAccount | undefined
  chain?: chain | undefined
  pollingInterval?: number | undefined
  retryCount?: TransportConfig['retryCount'] | undefined
  timeout?: TransportConfig['timeout'] | undefined
}) => {
  config: TransportConfig<type>
  request: TronRequestFn
  value?: rpcAttributes | undefined
}

export type CreateTransportErrorType = ErrorType

/**
 * Creates a transport intended to be used with a client. Returns the
 * `{ config, request, value }` envelope; `request` is `config.request`
 * wrapped by {@link buildRequest} (retry / dedupe / error normalization).
 */
export function createTransport<
  type extends string,
  rpcAttributes extends Record<string, any>,
>(
  {
    key,
    name,
    request,
    retryCount = 0,
    retryDelay = 150,
    timeout = 10_000,
    type,
  }: TransportConfig<type>,
  value?: rpcAttributes | undefined,
): ReturnType<Transport<type, rpcAttributes>> {
  const uid = uid_()
  return {
    config: {
      key,
      name,
      request,
      retryCount,
      retryDelay,
      timeout,
      type,
    },
    request: buildRequest(request, { retryCount, retryDelay, uid }),
    value,
  }
}
