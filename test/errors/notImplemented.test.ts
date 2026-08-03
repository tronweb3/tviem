// New test file for @tronweb3/tviem (no upstream errors/notImplemented.test.ts):
// rendered-message checks for the NotImplementedError placeholder class.
import { expect, test } from 'vitest'

import { BaseError } from '../../src/errors/base.js'
import { NotImplementedError } from '../../src/errors/notImplemented.js'

test('NotImplementedError (default feature)', () => {
  const err = new NotImplementedError()
  expect(err).toBeInstanceOf(BaseError)
  expect(err.name).toBe('NotImplementedError')
  expect(err).toMatchInlineSnapshot(`
    [NotImplementedError: This feature is not implemented yet.

    Version: @tronweb3/tviem@1.0.0-beta.1]
  `)
})

test('NotImplementedError (named feature + docsPath)', () => {
  expect(
    new NotImplementedError({
      feature: 'getContract().getEvents',
      docsPath: '/docs/contract/events',
    }),
  ).toMatchInlineSnapshot(`
    [NotImplementedError: getContract().getEvents is not implemented yet.

    Docs: https://github.com/tronweb3/tviem/docs/contract/events
    Version: @tronweb3/tviem@1.0.0-beta.1]
  `)
})
