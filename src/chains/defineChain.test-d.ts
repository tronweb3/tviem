import { expectTypeOf, test } from 'vitest'

import { defineChain } from './defineChain.js'

test('preserves literal inference', () => {
  const chain = defineChain({
    id: 3448148188,
    name: 'Tron Nile Testnet',
    nativeCurrency: { name: 'TRON', symbol: 'TRX', decimals: 6 },
    rpcUrls: {
      default: {
        full: { http: ['https://api.nileex.io'] },
        solidity: { http: ['https://api.nileex.io'] },
      },
    },
    blockTime: 3000,
    testnet: true,
  })

  // id/testnet keep their literal types, not widened to number/boolean
  expectTypeOf<typeof chain.id>().toEqualTypeOf<3448148188>()
  expectTypeOf<typeof chain.testnet>().toEqualTypeOf<true>()
  expectTypeOf<typeof chain.nativeCurrency.decimals>().toEqualTypeOf<6>()

  // `.extend` is attached and merges the overlay
  expectTypeOf(chain.extend).toBeFunction()
  const extended = chain.extend({ label: 'nile' })
  expectTypeOf<typeof extended.label>().toEqualTypeOf<'nile'>()
  expectTypeOf<typeof extended.id>().toEqualTypeOf<3448148188>()
})
