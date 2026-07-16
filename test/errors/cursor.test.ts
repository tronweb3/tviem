// New test file for @tronweb3/omni (no upstream errors/cursor.test.ts): constructibility checks for the vendored cursor error classes.
import { expect, test } from 'vitest'

import { BaseError } from '../../src/errors/base.js'
import {
  NegativeOffsetError,
  PositionOutOfBoundsError,
  RecursiveReadLimitExceededError,
} from '../../src/errors/cursor.js'

test('NegativeOffsetError', () => {
  const error = new NegativeOffsetError({ offset: -1 })
  expect(error).toBeInstanceOf(BaseError)
  expect(error.name).toBe('NegativeOffsetError')
  expect(error.shortMessage).toBe('Offset `-1` cannot be negative.')
})

test('PositionOutOfBoundsError', () => {
  const error = new PositionOutOfBoundsError({ length: 8, position: 9 })
  expect(error).toBeInstanceOf(BaseError)
  expect(error.name).toBe('PositionOutOfBoundsError')
  expect(error.shortMessage).toBe(
    'Position `9` is out of bounds (`0 < position < 8`).',
  )
})

test('RecursiveReadLimitExceededError', () => {
  const error = new RecursiveReadLimitExceededError({ count: 9, limit: 8 })
  expect(error).toBeInstanceOf(BaseError)
  expect(error.name).toBe('RecursiveReadLimitExceededError')
  expect(error.shortMessage).toBe(
    'Recursive read limit of `8` exceeded (recursive read count: `9`).',
  )
})
