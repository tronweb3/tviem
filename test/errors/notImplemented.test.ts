// New test file for @tronweb3/tviem (no upstream errors/notImplemented.test.ts):
// rendered-message checks for the NotImplementedError placeholder class.

import { expect, test } from 'vitest'
import { BaseError } from '../../src/errors/base.js'
import { NotImplementedError } from '../../src/errors/notImplemented.js'
import { version } from '../../src/errors/version.js'

test('NotImplementedError (default feature)', () => {
  const err = new NotImplementedError()
  expect(err).toBeInstanceOf(BaseError)
  expect(err.name).toBe('NotImplementedError')
  expect(err).toMatchObject({
    name: 'NotImplementedError',
    message: `This feature is not implemented yet.

Version: @tronweb3/tviem@${version}`,
  })
})

test('NotImplementedError (named feature + docsPath)', () => {
  expect(
    new NotImplementedError({
      feature: 'getContract().getEvents',
      docsPath: '/docs/contract/events',
    }),
  ).toMatchObject({
    name: 'NotImplementedError',
    message: `getContract().getEvents is not implemented yet.

Version: @tronweb3/tviem@${version}`,
  })
})
