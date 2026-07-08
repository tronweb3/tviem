// New test file for @tronweb3/omni (no upstream errors/data.test.ts): constructibility checks for the vendored data error classes.
import { expect, test } from 'vitest'

import { BaseError } from './base.js'
import {
  InvalidBytesLengthError,
  SizeExceedsPaddingSizeError,
  SliceOffsetOutOfBoundsError,
} from './data.js'

test('SliceOffsetOutOfBoundsError', () => {
  const error = new SliceOffsetOutOfBoundsError({
    offset: 10,
    position: 'start',
    size: 5,
  })
  expect(error).toBeInstanceOf(BaseError)
  expect(error.name).toBe('SliceOffsetOutOfBoundsError')
  expect(error.shortMessage).toBe(
    'Slice starting at offset "10" is out-of-bounds (size: 5).',
  )
  expect(
    new SliceOffsetOutOfBoundsError({ offset: 6, position: 'end', size: 5 })
      .shortMessage,
  ).toBe('Slice ending at offset "6" is out-of-bounds (size: 5).')
})

test('SizeExceedsPaddingSizeError', () => {
  const error = new SizeExceedsPaddingSizeError({
    size: 40,
    targetSize: 32,
    type: 'hex',
  })
  expect(error).toBeInstanceOf(BaseError)
  expect(error.name).toBe('SizeExceedsPaddingSizeError')
  expect(error.shortMessage).toBe('Hex size (40) exceeds padding size (32).')
})

test('InvalidBytesLengthError', () => {
  const error = new InvalidBytesLengthError({
    size: 20,
    targetSize: 21,
    type: 'bytes',
  })
  expect(error).toBeInstanceOf(BaseError)
  expect(error.name).toBe('InvalidBytesLengthError')
  expect(error.shortMessage).toBe(
    'Bytes is expected to be 21 bytes long, but is 20 bytes long.',
  )
})
