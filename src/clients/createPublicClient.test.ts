import { expect, test } from 'vitest'

import { createPublicClient } from './createPublicClient.js'
import {
  createTransport,
  type Transport,
} from './transports/createTransport.js'

const transport: Transport = () =>
  createTransport(
    {
      key: 'mock',
      name: 'Mock Transport',
      type: 'mock',
      request: async () => ({}) as any,
    },
    {},
  )

test('defaults to the public key/name and has no account', () => {
  const client = createPublicClient({ transport })
  expect(client.key).toBe('public')
  expect(client.name).toBe('Public Client')
  expect(client.type).toBe('publicClient')
  expect(client.account).toBeUndefined()
})

test('exposes the public action set', () => {
  const client = createPublicClient({ transport })
  for (const name of [
    'getBalance',
    'getBlock',
    'getNowBlock',
    'getTransactionInfo',
    'getChainParameters',
    'readContract',
    'waitForTransactionReceipt',
  ] as const)
    expect(typeof client[name]).toBe('function')
})

test('actions are still overridable via .extend', async () => {
  const client = createPublicClient({ transport }).extend(() => ({
    getBalance: async () => 42n,
  }))
  await expect(
    client.getBalance({ address: 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC' }),
  ).resolves.toBe(42n)
})
