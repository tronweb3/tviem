// Structure vendored (de-branded) and adapted for TRON: no EVM RPC schema, the
// public action set is TRON's read pipeline.
import type { TronAccount } from '../accounts/types.js'
import type { ErrorType } from '../errors/utils.js'
import type { ParseAccount } from '../types/account.js'
import type { Chain } from '../types/chain.js'
import type { Hex } from '../types/misc.js'
import type { Prettify } from '../types/utils.js'
import {
  type Client,
  type ClientConfig,
  type CreateClientErrorType,
  createClient,
} from './createClient.js'
import { type PublicActions, publicActions } from './decorators/public.js'
import type { Transport } from './transports/createTransport.js'

export type PublicClientConfig<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
> = Prettify<
  Pick<
    ClientConfig<transport, chain>,
    'cacheTime' | 'chain' | 'key' | 'name' | 'pollingInterval' | 'transport'
  >
>

export type PublicClient<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  account extends TronAccount | undefined = TronAccount | undefined,
> = Prettify<Client<transport, chain, account, PublicActions>>

export type CreatePublicClientErrorType = CreateClientErrorType | ErrorType

/**
 * Creates a Public Client with a given transport, configured for a chain. A
 * Public Client exposes the TRON read actions (balances, blocks, receipts,
 * contract reads).
 */
export function createPublicClient<
  transport extends Transport,
  chain extends Chain | undefined = undefined,
  accountOrAddress extends TronAccount | Hex | undefined = undefined,
>(
  parameters: PublicClientConfig<transport, chain>,
): PublicClient<transport, chain, ParseAccount<accountOrAddress>> {
  const { key = 'public', name = 'Public Client' } = parameters
  const client = createClient({
    ...parameters,
    key,
    name,
    type: 'publicClient',
  })
  return client.extend(publicActions) as PublicClient<
    transport,
    chain,
    ParseAccount<accountOrAddress>
  >
}
