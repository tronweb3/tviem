import { expect, test } from 'vitest'

import { defineChain } from '../../src/chains/defineChain.js'

const base = {
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
} as const

test('returns the chain with an extend method', () => {
  const chain = defineChain(base)
  expect(chain.id).toBe(3448148188)
  expect(chain.rpcUrls.default.full.http).toEqual(['https://api.nileex.io'])
  expect(typeof chain.extend).toBe('function')
})

test('extend overlays extra data (object form)', () => {
  const chain = defineChain(base).extend({ label: 'nile', priority: 1 })
  expect(chain.label).toBe('nile')
  expect(chain.priority).toBe(1)
  // base fields are preserved
  expect(chain.id).toBe(3448148188)
})

test('extend accepts a function form and is chainable', () => {
  const chain = defineChain(base)
    .extend((c) => ({ doubledId: c.id * 2 }))
    .extend({ note: 'ok' })
  expect(chain.doubledId).toBe(3448148188 * 2)
  expect(chain.note).toBe('ok')
  expect(chain.id).toBe(3448148188)
})

test('extend prefers overlay fields over base', () => {
  const chain = defineChain(base).extend({ name: 'Overridden' })
  expect(chain.name).toBe('Overridden')
})
