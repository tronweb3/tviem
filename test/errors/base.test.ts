import { expect, test } from 'vitest'
import { BaseError, setErrorConfig } from '../../src/errors/base.js'
import { version } from '../../src/errors/version.js'

test('BaseError', () => {
  expect(new BaseError('An error occurred.')).toMatchObject({
    name: 'BaseError',
    message: `An error occurred.

Version: @tronweb3/tviem@${version}`,
  })

  expect(
    new BaseError('An error occurred.', { details: 'details' }),
  ).toMatchObject({
    name: 'BaseError',
    message: `An error occurred.

Details: details
Version: @tronweb3/tviem@${version}`,
  })

  expect(new BaseError('', { details: 'details' })).toMatchObject({
    name: 'BaseError',
    message: `An error occurred.

Details: details
Version: @tronweb3/tviem@${version}`,
  })
})

test('BaseError (w/ docsPath)', () => {
  expect(
    new BaseError('An error occurred.', {
      details: 'details',
      docsPath: '/lol',
    }),
  ).toMatchObject({
    name: 'BaseError',
    message: `An error occurred.

Details: details
Version: @tronweb3/tviem@${version}`,
  })
  expect(
    new BaseError('An error occurred.', {
      cause: new BaseError('error', { docsPath: '/docs' }),
    }),
  ).toMatchObject({
    name: 'BaseError',
    message: `An error occurred.

Version: @tronweb3/tviem@${version}`,
  })
  expect(
    new BaseError('An error occurred.', {
      cause: new BaseError('error'),
      docsPath: '/lol',
    }),
  ).toMatchObject({
    name: 'BaseError',
    message: `An error occurred.

Version: @tronweb3/tviem@${version}`,
  })
  expect(
    new BaseError('An error occurred.', {
      details: 'details',
      docsPath: '/lol',
    }),
  ).toMatchObject({
    name: 'BaseError',
    message: `An error occurred.

Details: details
Version: @tronweb3/tviem@${version}`,
  })
})

test('BaseError (w/ docsBaseUrl)', () => {
  expect(
    new BaseError('An error occurred.', {
      docsBaseUrl: 'https://test',
      details: 'details',
      docsPath: '/lol',
    }),
  ).toMatchObject({
    name: 'BaseError',
    message: `An error occurred.

Details: details
Version: @tronweb3/tviem@${version}`,
  })
})

test('BaseError (w/ metaMessages)', () => {
  expect(
    new BaseError('An error occurred.', {
      details: 'details',
      metaMessages: ['Reason: idk', 'Cause: lol'],
    }),
  ).toMatchObject({
    name: 'BaseError',
    message: `An error occurred.

Reason: idk
Cause: lol

Details: details
Version: @tronweb3/tviem@${version}`,
  })
})

test('inherited BaseError', () => {
  const err = new BaseError('An error occurred.', {
    details: 'details',
    docsPath: '/lol',
  })
  expect(
    new BaseError('An internal error occurred.', {
      cause: err,
    }),
  ).toMatchObject({
    name: 'BaseError',
    message: `An internal error occurred.

Details: details
Version: @tronweb3/tviem@${version}`,
  })
})

test('inherited Error', () => {
  const err = new Error('details')
  expect(
    new BaseError('An internal error occurred.', {
      cause: err,
      docsPath: '/lol',
    }),
  ).toMatchObject({
    name: 'BaseError',
    message: `An internal error occurred.

Details: details
Version: @tronweb3/tviem@${version}`,
  })
})

test('walk: no predicate fn (walks to leaf)', () => {
  class FooError extends BaseError {}
  class BarError extends BaseError {}

  const err = new BaseError('test1', {
    cause: new FooError('test2', { cause: new BarError('test3') }),
  })
  expect(err.walk()).toMatchObject({
    name: 'BaseError',
    message: `test3

Version: @tronweb3/tviem@${version}`,
  })
})

test('walk: predicate fn', () => {
  class FooError extends BaseError {}
  class BarError extends BaseError {}

  const err = new BaseError('test1', {
    cause: new FooError('test2', { cause: new BarError('test3') }),
  })
  expect(err.walk((err) => err instanceof FooError)).toMatchObject({
    name: 'BaseError',
    message: `test2

Version: @tronweb3/tviem@${version}`,
  })
})

test('walk: predicate fn (no match)', () => {
  class FooError extends BaseError {}
  class BarError extends BaseError {}

  const err = new BaseError('test1', {
    cause: new Error('test2', { cause: new BarError('test3') }),
  })
  expect(err.walk((err) => err instanceof FooError)).toBeNull()
})

test('walk: undefined cause', () => {
  const withCauseUndefined = new Error('Cuase undefined', { cause: undefined })

  const err = new BaseError('test1', {
    cause: withCauseUndefined,
  })
  expect(err.walk()).toBe(withCauseUndefined)
})

test('setErrorConfig', () => {
  class FooError extends BaseError {
    constructor() {
      super('An error occurred', {
        name: 'FooError',
      })
    }
  }

  setErrorConfig({
    getDocsUrl({ name }) {
      if (name === 'FooError') return 'https://example.com/'
      return undefined
    },
    version: '@tronweb3/tviem@1.2.3',
  })

  expect(new BaseError('An error occurred.')).toMatchInlineSnapshot(`
    [BaseError: An error occurred.

    Version: @tronweb3/tviem@1.2.3]
  `)

  expect(new FooError()).toMatchInlineSnapshot(`
    [FooError: An error occurred

    Docs: https://example.com/
    Version: @tronweb3/tviem@1.2.3]
  `)
})
