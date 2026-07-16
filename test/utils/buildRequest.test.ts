import { expect, test, vi } from 'vitest'

import { TronValidationError, UnknownNodeError } from '../../src/errors/node.js'
import { HttpRequestError, TimeoutError } from '../../src/errors/request.js'
import { buildRequest, shouldRetryTron } from '../../src/utils/buildRequest.js'

const args = {
  path: 'getnowblock',
  node: 'full' as const,
  method: 'GET' as const,
}

test('resolves the underlying request', async () => {
  const inner = vi.fn(async () => ({ ok: true }))
  const request = buildRequest(inner, { retryDelay: 0, uid: 'a' })
  await expect(request(args)).resolves.toEqual({ ok: true })
  expect(inner).toHaveBeenCalledTimes(1)
})

test('retries retryable errors then succeeds', async () => {
  let calls = 0
  const inner = vi.fn(async () => {
    calls++
    if (calls < 3) throw new HttpRequestError({ status: 500, url: 'u' })
    return { ok: true }
  })
  const request = buildRequest(inner, {
    retryCount: 3,
    retryDelay: 0,
    uid: 'b',
  })
  await expect(request(args)).resolves.toEqual({ ok: true })
  expect(inner).toHaveBeenCalledTimes(3)
})

test('does not retry a TRON logical error and passes it through', async () => {
  const inner = vi.fn(async () => {
    throw new TronValidationError('bad')
  })
  const request = buildRequest(inner, {
    retryCount: 3,
    retryDelay: 0,
    uid: 'c',
  })
  await expect(request(args)).rejects.toBeInstanceOf(TronValidationError)
  expect(inner).toHaveBeenCalledTimes(1)
})

test('wraps a non-BaseError throw as UnknownNodeError', async () => {
  const inner = vi.fn(async () => {
    throw new Error('plain')
  })
  const request = buildRequest(inner, {
    retryCount: 0,
    retryDelay: 0,
    uid: 'd',
  })
  await expect(request(args)).rejects.toBeInstanceOf(UnknownNodeError)
})

test('deduplicates concurrent identical requests', async () => {
  let resolve: (v: unknown) => void = () => {}
  const inner = vi.fn(
    () => new Promise((r) => (resolve = r as (v: unknown) => void)),
  )
  const request = buildRequest(inner, { retryDelay: 0, uid: 'e' })
  const p1 = request(args, { dedupe: true })
  const p2 = request(args, { dedupe: true })
  resolve({ ok: 1 })
  await Promise.all([p1, p2])
  expect(inner).toHaveBeenCalledTimes(1)
})

test('shouldRetryTron: retries transient, refuses logical', () => {
  expect(shouldRetryTron(new HttpRequestError({ status: 403, url: 'u' }))).toBe(
    true,
  )
  expect(shouldRetryTron(new HttpRequestError({ status: 429, url: 'u' }))).toBe(
    true,
  )
  expect(shouldRetryTron(new HttpRequestError({ status: 503, url: 'u' }))).toBe(
    true,
  )
  expect(shouldRetryTron(new HttpRequestError({ status: 400, url: 'u' }))).toBe(
    false,
  )
  expect(shouldRetryTron(new TronValidationError('x'))).toBe(false)
  expect(shouldRetryTron(new TimeoutError({ body: {}, url: 'u' }))).toBe(true)
})
