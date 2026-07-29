import { expect, test, vi } from 'vitest'
import { createTransport } from '../../../src/clients/transports/createTransport.js'
import type { TronRequestFn } from '../../../src/types/transport.js'

function setup(request: TronRequestFn) {
  return createTransport(
    { key: 'mock', name: 'Mock', request, type: 'mock' },
    { foo: 'bar' },
  )
}

test('returns the { config, request, value } envelope with defaults', () => {
  const request = (async () => ({})) as TronRequestFn
  const transport = setup(request)
  expect(transport.config).toMatchObject({
    key: 'mock',
    name: 'Mock',
    type: 'mock',
    retryCount: 3,
    retryDelay: 150,
    timeout: 10_000,
  })
  expect(typeof transport.request).toBe('function')
  expect(transport.value).toEqual({ foo: 'bar' })
})

test('config.request is the raw request; transport.request is wrapped', () => {
  const inner = vi.fn(async () => ({ ok: true }))
  const transport = setup(inner as unknown as TronRequestFn)
  expect(transport.config.request).toBe(inner)
  expect(transport.request).not.toBe(inner)
})

test('transport.request routes through to the raw request', async () => {
  const inner = vi.fn(async () => ({ ok: true }))
  const transport = setup(inner as unknown as TronRequestFn)
  await expect(transport.request({ path: 'getnowblock' })).resolves.toEqual({
    ok: true,
  })
  expect(inner).toHaveBeenCalledTimes(1)
})
