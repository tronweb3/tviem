// New test file for @tronweb3/tviem (no upstream errors/transport.test.ts):
// rendered-message check for the transport error class.
import { expect, test } from 'vitest'

import { BaseError } from '../../src/errors/base.js'
import { UrlRequiredError } from '../../src/errors/transport.js'

test('UrlRequiredError', () => {
  const err = new UrlRequiredError()
  expect(err).toBeInstanceOf(BaseError)
  expect(err.name).toBe('UrlRequiredError')
  expect(err).toMatchInlineSnapshot(`
    [UrlRequiredError: No URL was provided to the Transport. Please provide a valid node URL to the Transport.

    Version: @tronweb3/tviem@1.0.0-beta.1]
  `)
})
