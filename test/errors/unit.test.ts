// New test file for @tronweb3/omni (no upstream errors/unit.test.ts): constructibility check for the vendored unit error class.
import { expect, test } from 'vitest'

import { BaseError } from '../../src/errors/base.js'
import { InvalidDecimalNumberError } from '../../src/errors/unit.js'

test('InvalidDecimalNumberError', () => {
  const error = new InvalidDecimalNumberError({ value: '1.0.0' })
  expect(error).toBeInstanceOf(BaseError)
  expect(error.name).toBe('InvalidDecimalNumberError')
  expect(error.shortMessage).toBe(
    'Number `1.0.0` is not a valid decimal number.',
  )
})
