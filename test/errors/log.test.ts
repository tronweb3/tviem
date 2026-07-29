// New test file for @tronweb3/tviem (no upstream errors/log.test.ts): constructibility check for the vendored log error class.
import { expect, test } from 'vitest'

import { BaseError } from '../../src/errors/base.js'
import { FilterTypeNotSupportedError } from '../../src/errors/log.js'

test('FilterTypeNotSupportedError', () => {
  const error = new FilterTypeNotSupportedError('event')
  expect(error).toBeInstanceOf(BaseError)
  expect(error.name).toBe('FilterTypeNotSupportedError')
  expect(error.shortMessage).toBe('Filter type "event" is not supported.')
})
