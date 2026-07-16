import { expect, test } from 'vitest'

import { mainnet } from '../../../src/chains/definitions/mainnet.js'
import { nile } from '../../../src/chains/definitions/nile.js'
import { shasta } from '../../../src/chains/definitions/shasta.js'

test('mainnet', () => {
  expect(mainnet.id).toBe(728126428)
  expect(mainnet.name).toBe('Tron Mainnet')
  expect(mainnet.nativeCurrency).toEqual({
    name: 'TRON',
    symbol: 'TRX',
    decimals: 6,
  })
  expect(mainnet.rpcUrls.default.full.http).toEqual(['https://api.trongrid.io'])
  expect(mainnet.rpcUrls.default.solidity.http).toEqual([
    'https://api.trongrid.io',
  ])
  expect(mainnet.blockTime).toBe(3000)
  expect('testnet' in mainnet).toBe(false)
})

test('nile', () => {
  expect(nile.id).toBe(3448148188)
  expect(nile.name).toBe('Tron Nile Testnet')
  expect(nile.nativeCurrency.decimals).toBe(6)
  expect(nile.rpcUrls.default.full.http).toEqual(['https://api.nileex.io'])
  expect(nile.rpcUrls.default.solidity.http).toEqual(['https://api.nileex.io'])
  expect(nile.blockTime).toBe(3000)
  expect(nile.testnet).toBe(true)
})

test('shasta', () => {
  expect(shasta.id).toBe(2494104990)
  expect(shasta.name).toBe('Tron Shasta Testnet')
  expect(shasta.nativeCurrency.decimals).toBe(6)
  expect(shasta.rpcUrls.default.full.http).toEqual([
    'https://api.shasta.trongrid.io',
  ])
  expect(shasta.rpcUrls.default.solidity.http).toEqual([
    'https://api.shasta.trongrid.io',
  ])
  expect(shasta.blockTime).toBe(3000)
  expect(shasta.testnet).toBe(true)
})

test('all chains expose default full + solidity endpoints with 6-decimal TRX', () => {
  for (const chain of [mainnet, nile, shasta]) {
    expect(chain.nativeCurrency.symbol).toBe('TRX')
    expect(chain.nativeCurrency.decimals).toBe(6)
    expect(chain.rpcUrls.default.full.http.length).toBeGreaterThan(0)
    expect(chain.rpcUrls.default.solidity.http.length).toBeGreaterThan(0)
  }
})
