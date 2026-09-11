// New test file for @tronweb3/tviem: field + credential-stripping checks for
// the HTTP request error classes (no upstream errors/request.test.ts).
import { expect, test } from 'vitest'

import { BaseError } from '../../src/errors/base.js'
import { HttpRequestError, TimeoutError } from '../../src/errors/request.js'

test('HttpRequestError carries body / headers / status / url', () => {
  const body = { address: '4112' }
  const headers = new Headers({ 'x-trace': 'abc' })
  const err = new HttpRequestError({
    body,
    headers,
    status: 500,
    url: 'https://node.example/wallet/getaccount',
  })
  expect(err).toBeInstanceOf(BaseError)
  expect(err.name).toBe('HttpRequestError')
  expect(err.body).toEqual(body)
  expect(err.headers).toBe(headers)
  expect(err.headers?.get('x-trace')).toBe('abc')
  expect(err.status).toBe(500)
  expect(err.url).toBe('https://node.example/wallet/getaccount')
  expect(err.message).toContain('Status: 500')
  expect(err.message).toContain('URL: https://node.example/wallet/getaccount')
  expect(err.message).toContain('Request body: {"address":"4112"}')
})

test('HttpRequestError strips basic-auth credentials from the URL in metaMessages and on the instance', () => {
  const err = new HttpRequestError({
    url: 'https://user:pass@node.example/wallet/getaccount',
  })
  // The public `url` property must not leak credentials either — it is easy
  // to forward an error object into logs/telemetry wholesale.
  expect(err.url).toBe('https://node.example/wallet/getaccount')
  // The rendered message never leaks the `user:pass@` credentials.
  expect(err.message).toContain('URL: https://node.example/wallet/getaccount')
  expect(err.message).not.toContain('user:pass')
  expect(err.message).not.toContain('pass@')
})

test('HttpRequestError with a fetch cause surfaces the cause message as Details', () => {
  const err = new HttpRequestError({
    cause: new TypeError('network down'),
    url: 'https://node.example/wallet/getnowblock',
  })
  expect(err).toBeInstanceOf(BaseError)
  expect(err.details).toBe('network down')
  expect(err.status).toBeUndefined()
  expect(err.message).toContain('Details: network down')
})

test('TimeoutError reports the (credential-stripped) url and a timeout detail', () => {
  const err = new TimeoutError({
    body: { path: 'getnowblock' },
    url: 'https://user:pass@node.example/wallet/getnowblock',
  })
  expect(err).toBeInstanceOf(BaseError)
  expect(err.name).toBe('TimeoutError')
  expect(err.url).toBe('https://node.example/wallet/getnowblock')
  expect(err.details).toBe('The request timed out.')
  expect(err.shortMessage).toBe('The request took too long to respond.')
  expect(err.message).toContain('URL: https://node.example/wallet/getnowblock')
  expect(err.message).not.toContain('user:pass')
  expect(err.message).toContain('Request body: {"path":"getnowblock"}')
})
