// New test file for @tronweb3/tviem: constructibility checks for the
// transaction error classes.
import { expect, test } from 'vitest'

import { BaseError } from '../../src/errors/base.js'
import { UnknownContractTypeError } from '../../src/errors/transaction.js'

test('UnknownContractTypeError: type URL with payload', () => {
  const error = new UnknownContractTypeError({
    type: 'type.googleapis.com/protocol.FooBarContract',
    value: 'deadbeef',
  })
  expect(error).toBeInstanceOf(BaseError)
  expect(error.name).toBe('UnknownContractTypeError')
  expect(error.type).toBe('type.googleapis.com/protocol.FooBarContract')
  expect(error.value).toBe('deadbeef')
  expect(error.shortMessage).toBe(
    'Contract type "type.googleapis.com/protocol.FooBarContract" is not supported.',
  )
  // The raw payload is preserved on the rendered message for inspection.
  expect(error.message).toContain('Any.value (hex): deadbeef')
})

test('UnknownContractTypeError: numeric type without payload', () => {
  const error = new UnknownContractTypeError({ type: 999 })
  expect(error).toBeInstanceOf(BaseError)
  expect(error.type).toBe(999)
  expect(error.value).toBeUndefined()
  expect(error.shortMessage).toBe('Contract type 999 is not supported.')
  expect(error.message).not.toContain('Any.value')
})
