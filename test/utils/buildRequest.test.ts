import { expect, test, vi } from 'vitest'

import { TronValidationError, UnknownNodeError } from '../../src/errors/node.js'
import { HttpRequestError, TimeoutError } from '../../src/errors/request.js'
import { getAbortError } from '../../src/errors/utils.js'
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

test('dedupe: aborting the second caller rejects only that caller', async () => {
  let resolve: (v: unknown) => void = () => {}
  const inner = vi.fn(
    (_args: unknown, options?: { signal?: AbortSignal | undefined }) =>
      new Promise((res, rej) => {
        resolve = res as (v: unknown) => void
        options?.signal?.addEventListener('abort', () =>
          rej(getAbortError(options.signal)),
        )
      }),
  )
  const request = buildRequest(inner, { retryDelay: 0, uid: 'i' })
  const controllerA = new AbortController()
  const controllerB = new AbortController()
  const p1 = request(args, { dedupe: true, signal: controllerA.signal })
  const p2 = request(args, { dedupe: true, signal: controllerB.signal })
  controllerB.abort()
  resolve({ ok: 1 })
  await expect(p2).rejects.toMatchObject({ name: 'AbortError' })
  await expect(p1).resolves.toEqual({ ok: 1 })
  expect(inner).toHaveBeenCalledTimes(1)
})

test('dedupe: aborting the first caller does not cancel other waiters', async () => {
  let resolve: (v: unknown) => void = () => {}
  const inner = vi.fn(
    (_args: unknown, options?: { signal?: AbortSignal | undefined }) =>
      new Promise((res, rej) => {
        resolve = res as (v: unknown) => void
        options?.signal?.addEventListener('abort', () =>
          rej(getAbortError(options.signal)),
        )
      }),
  )
  const request = buildRequest(inner, { retryDelay: 0, uid: 'j' })
  const controllerA = new AbortController()
  const controllerB = new AbortController()
  const p1 = request(args, { dedupe: true, signal: controllerA.signal })
  const p2 = request(args, { dedupe: true, signal: controllerB.signal })
  controllerA.abort()
  resolve({ ok: 1 })
  await expect(p1).rejects.toMatchObject({ name: 'AbortError' })
  await expect(p2).resolves.toEqual({ ok: 1 })
  expect(inner).toHaveBeenCalledTimes(1)
})

test('honors an HTTP-date Retry-After by waiting until that date', async () => {
  vi.useFakeTimers()
  try {
    vi.setSystemTime(new Date('2026-08-25T00:00:00.000Z'))
    const headers = new Headers({
      'Retry-After': new Date(Date.now() + 5000).toUTCString(),
    })
    let calls = 0
    const inner = vi.fn(async () => {
      calls++
      if (calls === 1)
        throw new HttpRequestError({ status: 429, url: 'u', headers })
      return { ok: true }
    })
    const request = buildRequest(inner, {
      retryCount: 1,
      retryDelay: 150,
      uid: 'f',
    })
    const promise = request(args)
    await vi.advanceTimersByTimeAsync(0)
    expect(inner).toHaveBeenCalledTimes(1)
    // Just before the date: still waiting.
    await vi.advanceTimersByTimeAsync(4998)
    expect(inner).toHaveBeenCalledTimes(1)
    // Past the date: the retry fires.
    await vi.advanceTimersByTimeAsync(5001)
    await expect(promise).resolves.toEqual({ ok: true })
    expect(inner).toHaveBeenCalledTimes(2)
  } finally {
    vi.useRealTimers()
  }
})

test('honors a delay-seconds Retry-After', async () => {
  vi.useFakeTimers()
  try {
    const headers = new Headers({ 'Retry-After': '2' })
    let calls = 0
    const inner = vi.fn(async () => {
      calls++
      if (calls === 1)
        throw new HttpRequestError({ status: 429, url: 'u', headers })
      return { ok: true }
    })
    const request = buildRequest(inner, {
      retryCount: 1,
      retryDelay: 150,
      uid: 'g',
    })
    const promise = request(args)
    await vi.advanceTimersByTimeAsync(0)
    expect(inner).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1998)
    expect(inner).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(3)
    await expect(promise).resolves.toEqual({ ok: true })
    expect(inner).toHaveBeenCalledTimes(2)
  } finally {
    vi.useRealTimers()
  }
})

test('falls back to exponential backoff when Retry-After yields no future time', async () => {
  vi.useFakeTimers()
  try {
    const headers = new Headers({ 'Retry-After': 'later-5' })
    let calls = 0
    const inner = vi.fn(async () => {
      calls++
      if (calls === 1)
        throw new HttpRequestError({ status: 429, url: 'u', headers })
      return { ok: true }
    })
    const request = buildRequest(inner, {
      retryCount: 1,
      retryDelay: 150,
      uid: 'h',
    })
    const promise = request(args)
    await vi.advanceTimersByTimeAsync(0)
    // Must not retry with zero delay: the backoff (150ms) applies instead.
    expect(inner).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(150)
    await expect(promise).resolves.toEqual({ ok: true })
    expect(inner).toHaveBeenCalledTimes(2)
  } finally {
    vi.useRealTimers()
  }
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
