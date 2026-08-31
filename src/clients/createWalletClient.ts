import type { AccountKey, TronAccount } from '../accounts/types.js'
import type { ErrorType } from '../errors/utils.js'
import type { ParseAccount } from '../types/account.js'
import type { Chain } from '../types/chain.js'
import type { Prettify } from '../types/utils.js'
import {
  type Client,
  type ClientConfig,
  type CreateClientErrorType,
  createClient,
} from './createClient.js'
import { type WalletActions, walletActions } from './decorators/wallet.js'
import type { Transport } from './transports/createTransport.js'

export type WalletClientConfig<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  accountOrKey extends TronAccount | AccountKey | undefined =
    | TronAccount
    | AccountKey
    | undefined,
> = Prettify<
  Pick<
    ClientConfig<transport, chain, accountOrKey>,
    | 'account'
    | 'cacheTime'
    | 'chain'
    | 'key'
    | 'name'
    | 'pollingInterval'
    | 'transport'
  >
>

export type WalletClient<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  account extends TronAccount | undefined = TronAccount | undefined,
> = Prettify<Client<transport, chain, account, WalletActions>>

export type CreateWalletClientErrorType = CreateClientErrorType | ErrorType

/**
 * Creates a Wallet Client with a given transport, configured for a chain. The
 * `account` — a built account, or a private key (`0x`-prefixed or bare hex)
 * resolved to a local account — is hoisted onto the Client so write actions
 * can omit it. A Wallet Client exposes the TRON write actions
 * (`sendTrx`, `writeContract`, `broadcastTransaction`).
 */
export function createWalletClient<
  transport extends Transport,
  chain extends Chain | undefined = undefined,
  accountOrKey extends TronAccount | AccountKey | undefined = undefined,
>(
  parameters: WalletClientConfig<transport, chain, accountOrKey>,
): WalletClient<transport, chain, ParseAccount<accountOrKey>> {
  const { key = 'wallet', name = 'Wallet Client', transport } = parameters
  const client = createClient({
    ...parameters,
    key,
    name,
    transport,
    type: 'walletClient',
  })
  return client.extend(walletActions) as WalletClient<
    transport,
    chain,
    ParseAccount<accountOrKey>
  >
}
