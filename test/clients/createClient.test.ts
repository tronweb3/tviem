import { expect, test } from 'vitest'
import { createClient } from '../../src/clients/createClient.js'
import {
  createTransport,
  type Transport,
} from '../../src/clients/transports/createTransport.js'
import type { Chain } from '../../src/types/chain.js'
import { getAction } from '../../src/utils/getAction.js'

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

const chainWith = (blockTime: number) => ({ blockTime }) as unknown as Chain

// pk=1 → a well-known local account (see privateKeyToAccount).
const pk1 = '0x0000000000000000000000000000000000000000000000000000000000000001'

test('default fields', () => {
  const client = createClient({ transport })
  expect(client.key).toBe('base')
  expect(client.name).toBe('Base Client')
  expect(client.type).toBe('base')
  expect(client.account).toBeUndefined()
  expect(typeof client.uid).toBe('string')
  expect(client.uid.length).toBeGreaterThan(0)
  expect(typeof client.request).toBe('function')
  // no chain → blockTime 3000 → ⌊1500⌋ clamped to [500, 3000] = 1500
  expect(client.pollingInterval).toBe(1500)
  expect(client.cacheTime).toBe(1500)
})

test('pollingInterval clamps around ⌊blockTime / 2⌋', () => {
  // small block time → clamped up to 500
  expect(
    createClient({ chain: chainWith(800), transport }).pollingInterval,
  ).toBe(500)
  // nominal 3000 → 1500
  expect(
    createClient({ chain: chainWith(3000), transport }).pollingInterval,
  ).toBe(1500)
  // large block time → clamped down to 3000
  expect(
    createClient({ chain: chainWith(12_000), transport }).pollingInterval,
  ).toBe(3000)
})

test('explicit pollingInterval / cacheTime override defaults', () => {
  const client = createClient({
    cacheTime: 111,
    pollingInterval: 222,
    transport,
  })
  expect(client.pollingInterval).toBe(222)
  expect(client.cacheTime).toBe(111)
})

test('cacheTime defaults to pollingInterval', () => {
  const client = createClient({ pollingInterval: 777, transport })
  expect(client.cacheTime).toBe(777)
})

test('account is parsed from a private-key string', () => {
  const client = createClient({ account: pk1, transport })
  expect(client.account?.type).toBe('local')
  expect(client.account?.source).toBe('privateKey')
  expect(client.account?.address).toBe('TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC')
})

test('transport is flattened into { ...config, ...value }', () => {
  const client = createClient({ transport })
  expect(client.transport.key).toBe('mock')
  expect(client.transport.type).toBe('mock')
})

test('.extend adds actions', () => {
  const client = createClient({ transport }).extend(() => ({
    foo: () => 'bar',
  }))
  expect(client.foo()).toBe('bar')
})

test('.extend cannot overwrite base client fields', () => {
  const client = createClient({ transport }).extend(
    () => ({ key: 'HACKED', name: 'HACKED', foo: () => 'ok' }) as any,
  )
  expect(client.key).toBe('base')
  expect(client.name).toBe('Base Client')
  expect((client as any).foo()).toBe('ok')
})

test('.extend shallow-merges plain-object namespaces', () => {
  const client = createClient({ transport })
    .extend(() => ({ ns: { a: 1 } }))
    .extend(() => ({ ns: { b: 2 } }))
  expect((client as any).ns).toEqual({ a: 1, b: 2 })
})

test('.extend rebinds recursively', () => {
  const client = createClient({ transport })
    .extend(() => ({ a: () => 1 }))
    .extend(() => ({ b: () => 2 }))
  expect((client as any).a()).toBe(1)
  expect((client as any).b()).toBe(2)
  expect(typeof client.extend).toBe('function')
})

test('getAction resolves an overridden action on the client', () => {
  function inner(_client: unknown, _parameters: unknown) {
    return 'fallback'
  }

  const overridden = createClient({ transport })
    .extend(() => ({ inner: () => 'v1' }))
    .extend((c) => ({
      outer: () => getAction(c, inner, 'inner')(undefined),
    }))
  expect((overridden as any).outer()).toBe('v1')

  const fallback = createClient({ transport }).extend((c) => ({
    outer: () => getAction(c, inner, 'inner')(undefined),
  }))
  expect((fallback as any).outer()).toBe('fallback')
})
