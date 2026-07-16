import { expectTypeOf, test } from 'vitest'

import type {
  Chain,
  TronNativeCurrency,
  TronRpcEndpoint,
  TronRpcUrls,
} from '../../src/types/chain.js'

test('TronNativeCurrency', () => {
  expectTypeOf<TronNativeCurrency>().toEqualTypeOf<{
    name: string
    symbol: string
    decimals: 6
  }>()

  // decimals is pinned to the literal 6, not widened to number
  expectTypeOf<TronNativeCurrency['decimals']>().toEqualTypeOf<6>()
  expectTypeOf<number>().not.toExtend<TronNativeCurrency['decimals']>()
})

test('TronRpcUrls', () => {
  expectTypeOf<TronRpcUrls['full']>().toEqualTypeOf<TronRpcEndpoint>()
  expectTypeOf<TronRpcUrls['solidity']>().toEqualTypeOf<TronRpcEndpoint>()
  // event is reserved (optional)
  expectTypeOf<TronRpcUrls['event']>().toEqualTypeOf<
    TronRpcEndpoint | undefined
  >()
  expectTypeOf<TronRpcEndpoint['http']>().toEqualTypeOf<readonly string[]>()
})

test('Chain', () => {
  expectTypeOf<Chain['id']>().toEqualTypeOf<number>()
  expectTypeOf<Chain['name']>().toEqualTypeOf<string>()
  expectTypeOf<Chain['nativeCurrency']>().toEqualTypeOf<TronNativeCurrency>()
  expectTypeOf<Chain['rpcUrls']['default']>().toEqualTypeOf<TronRpcUrls>()
  expectTypeOf<Chain['blockTime']>().toEqualTypeOf<number | undefined>()
  expectTypeOf<Chain['testnet']>().toEqualTypeOf<boolean | undefined>()

  // a well-formed literal is assignable to Chain
  expectTypeOf<{
    id: 3448148188
    name: 'Tron Nile Testnet'
    nativeCurrency: { name: 'TRON'; symbol: 'TRX'; decimals: 6 }
    rpcUrls: {
      default: {
        full: { http: ['https://api.nileex.io'] }
        solidity: { http: ['https://api.nileex.io'] }
      }
    }
    blockTime: 3000
    testnet: true
  }>().toExtend<Chain>()
})
