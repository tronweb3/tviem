import { expect, test } from 'vitest'

import { withDedupe } from '../../../src/utils/promise/withDedupe.js'

test('shares one in-flight promise per id', async () => {
  let calls = 0
  let resolve: (value: string) => void = () => {}
  const fn = () => {
    calls++
    return new Promise<string>((r) => (resolve = r))
  }
  const p1 = withDedupe(fn, { id: 'dedupe.share' })
  const p2 = withDedupe(fn, { id: 'dedupe.share' })
  resolve('ok')
  await expect(p1).resolves.toBe('ok')
  await expect(p2).resolves.toBe('ok')
  expect(calls).toBe(1)
})

test('aborting one waiter rejects only that waiter', async () => {
  let calls = 0
  let resolve: (value: string) => void = () => {}
  const fn = () => {
    calls++
    return new Promise<string>((r) => (resolve = r))
  }
  const controllerA = new AbortController()
  const controllerB = new AbortController()
  const p1 = withDedupe(fn, { id: 'dedupe.waiter', signal: controllerA.signal })
  const p2 = withDedupe(fn, { id: 'dedupe.waiter', signal: controllerB.signal })
  controllerB.abort()
  resolve('ok')
  await expect(p2).rejects.toMatchObject({ name: 'AbortError' })
  await expect(p1).resolves.toBe('ok')
  expect(calls).toBe(1)
})

test('aborting the creator does not affect other waiters', async () => {
  let calls = 0
  let resolve: (value: string) => void = () => {}
  const fn = () => {
    calls++
    return new Promise<string>((r) => (resolve = r))
  }
  const controllerA = new AbortController()
  const controllerB = new AbortController()
  const p1 = withDedupe(fn, {
    id: 'dedupe.creator',
    signal: controllerA.signal,
  })
  const p2 = withDedupe(fn, {
    id: 'dedupe.creator',
    signal: controllerB.signal,
  })
  controllerA.abort()
  resolve('ok')
  await expect(p1).rejects.toMatchObject({ name: 'AbortError' })
  await expect(p2).resolves.toBe('ok')
  expect(calls).toBe(1)
})

test('an already-aborted signal rejects without invoking fn', async () => {
  const controller = new AbortController()
  controller.abort()
  let calls = 0
  const fn = () => {
    calls++
    return Promise.resolve('ok')
  }
  await expect(
    withDedupe(fn, { id: 'dedupe.pre-aborted', signal: controller.signal }),
  ).rejects.toMatchObject({ name: 'AbortError' })
  expect(calls).toBe(0)
})

test('a shared failure still propagates to waiters that did not abort', async () => {
  let reject: (error: Error) => void = () => {}
  const fn = () => new Promise<string>((_, r) => (reject = r))
  const controllerA = new AbortController()
  const p1 = withDedupe(fn, {
    id: 'dedupe.failure',
    signal: controllerA.signal,
  })
  const p2 = withDedupe(fn, { id: 'dedupe.failure' })
  controllerA.abort()
  reject(new Error('boom'))
  await expect(p1).rejects.toMatchObject({ name: 'AbortError' })
  await expect(p2).rejects.toThrow('boom')
})
