import type { TronAccount } from '../accounts/types.js'
import type { ErrorType } from '../errors/utils.js'
import {
  type ParseAccount,
  type ParseAccountErrorType,
  parseAccount,
} from '../types/account.js'
import type { Chain } from '../types/chain.js'
import type { Hex } from '../types/misc.js'
import type { Prettify } from '../types/utils.js'
import { uid } from '../utils/uid.js'
import type { Transport } from './transports/createTransport.js'

export type ClientConfig<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  accountOrAddress extends TronAccount | Hex | undefined =
    | TronAccount
    | Hex
    | undefined,
> = {
  /** The Account to use for the Client. Used by Actions that require an account. */
  account?: accountOrAddress | TronAccount | Hex | undefined
  /**
   * Time (in ms) that cached data will remain in memory.
   * @default pollingInterval
   */
  cacheTime?: number | undefined
  /** Chain for the client. */
  chain?: Chain | undefined | chain
  /** A key for the client. */
  key?: string | undefined
  /** A name for the client. */
  name?: string | undefined
  /**
   * Frequency (in ms) for polling enabled actions.
   * @default clamp(⌊chain.blockTime / 2⌋, 500, 3000)
   */
  pollingInterval?: number | undefined
  /** The RPC transport. */
  transport: transport
  /** The type of client. */
  type?: string | undefined
}

export type Client<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  account extends TronAccount | undefined = TronAccount | undefined,
  extended extends Extended | undefined = Extended | undefined,
> = Client_Base<transport, chain, account> &
  (extended extends Extended ? extended : unknown) & {
    extend: <const client extends Extended>(
      fn: (client: Client<transport, chain, account, extended>) => client,
    ) => Client<
      transport,
      chain,
      account,
      Prettify<client> & (extended extends Extended ? extended : unknown)
    >
  }

type Client_Base<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  account extends TronAccount | undefined = TronAccount | undefined,
> = {
  /** The Account of the Client. */
  account: account
  /** Time (in ms) that cached data will remain in memory. */
  cacheTime: number
  /** Chain for the client. */
  chain: chain
  /** A key for the client. */
  key: string
  /** A name for the client. */
  name: string
  /** Frequency (in ms) for polling enabled actions. */
  pollingInterval: number
  /** Request function wrapped with retry / dedupe / error normalization. */
  request: ReturnType<transport>['request']
  /** The flattened transport (`{ ...config, ...value }`). */
  transport: ReturnType<transport>['config'] & ReturnType<transport>['value']
  /** The type of client. */
  type: string
  /** A unique ID for the client. */
  uid: string
}

type Extended = Prettify<
  // disallow redefining base properties
  { [_ in keyof Client_Base]?: undefined } & {
    [key: string]: unknown
  }
>

export type CreateClientErrorType = ParseAccountErrorType | ErrorType

export function createClient<
  transport extends Transport,
  chain extends Chain | undefined = undefined,
  accountOrAddress extends TronAccount | Hex | undefined = undefined,
>(
  parameters: ClientConfig<transport, chain, accountOrAddress>,
): Prettify<Client<transport, chain, ParseAccount<accountOrAddress>>>

export function createClient(parameters: ClientConfig): Client {
  const {
    chain,
    key = 'base',
    name = 'Base Client',
    type = 'base',
  } = parameters

  const blockTime = chain?.blockTime ?? 3_000
  const defaultPollingInterval = Math.min(
    Math.max(Math.floor(blockTime / 2), 500),
    3_000,
  )
  const pollingInterval = parameters.pollingInterval ?? defaultPollingInterval
  const cacheTime = parameters.cacheTime ?? pollingInterval

  const account = parameters.account
    ? parseAccount(parameters.account)
    : undefined
  const { config, request, value } = parameters.transport({
    account,
    chain,
    pollingInterval,
  })
  const transport = { ...config, ...value }

  const client = {
    account,
    cacheTime,
    chain,
    key,
    name,
    pollingInterval,
    request,
    transport,
    type,
    uid: uid(),
  }

  function extend(base: typeof client) {
    type ExtendFn = (base: typeof client) => unknown
    return (extendFn: ExtendFn) => {
      const extended = extendFn(base) as Extended
      for (const key in client) delete extended[key]
      const combined = { ...base, ...extended }
      // For keys that exist on both the base client and the extension and
      // resolve to plain objects (e.g. shared namespaces) shallow-merge their
      // members instead of overwriting. This lets separate decorators
      // contribute members to the same namespace.
      for (const key in extended) {
        const a = (base as Record<string, unknown>)[key]
        const b = (extended as Record<string, unknown>)[key]
        if (isPlainObject(a) && isPlainObject(b))
          (combined as Record<string, unknown>)[key] = { ...a, ...b }
      }
      return Object.assign(combined, { extend: extend(combined as any) })
    }
  }

  return Object.assign(client, { extend: extend(client) as any })
}

/** Whether `value` is a plain object (`{}`), as opposed to a function, array,
 * or class instance. Used to decide which extension namespaces to merge. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
