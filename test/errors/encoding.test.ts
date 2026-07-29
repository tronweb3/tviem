// New test file for @tronweb3/tviem (no upstream errors/encoding.test.ts): constructibility checks for the vendored encoding error classes.
import { expect, test } from 'vitest'

import { BaseError } from '../../src/errors/base.js'
import {
  IntegerOutOfRangeError,
  InvalidBytesBooleanError,
  InvalidHexBooleanError,
  InvalidHexValueError,
  RlpDepthLimitExceededError,
  SizeOverflowError,
} from '../../src/errors/encoding.js'

test('IntegerOutOfRangeError', () => {
  const error = new IntegerOutOfRangeError({
    max: '255',
    min: '0',
    signed: false,
    size: 1,
    value: '256',
  })
  expect(error).toBeInstanceOf(BaseError)
  expect(error.name).toBe('IntegerOutOfRangeError')
  expect(error.shortMessage).toBe(
    'Number "256" is not in safe 8-bit unsigned integer range (0 to 255)',
  )
  expect(
    new IntegerOutOfRangeError({ min: '0', value: '-1' }).shortMessage,
  ).toBe('Number "-1" is not in safe integer range (above 0)')
})

test('InvalidBytesBooleanError', () => {
  const error = new InvalidBytesBooleanError(new Uint8Array([2]))
  expect(error).toBeInstanceOf(BaseError)
  expect(error.name).toBe('InvalidBytesBooleanError')
  expect(error.shortMessage).toBe(
    'Bytes value "2" is not a valid boolean. The bytes array must contain a single byte of either a 0 or 1 value.',
  )
})

test('InvalidHexBooleanError', () => {
  const error = new InvalidHexBooleanError('0xa')
  expect(error).toBeInstanceOf(BaseError)
  expect(error.name).toBe('InvalidHexBooleanError')
  expect(error.shortMessage).toBe(
    'Hex value "0xa" is not a valid boolean. The hex value must be "0x0" (false) or "0x1" (true).',
  )
})

test('InvalidHexValueError', () => {
  const error = new InvalidHexValueError('0x0a1')
  expect(error).toBeInstanceOf(BaseError)
  expect(error.name).toBe('InvalidHexValueError')
  expect(error.shortMessage).toBe(
    'Hex value "0x0a1" is an odd length (5). It must be an even length.',
  )
})

test('RlpDepthLimitExceededError', () => {
  const error = new RlpDepthLimitExceededError({ limit: 3 })
  expect(error).toBeInstanceOf(BaseError)
  expect(error.name).toBe('RlpDepthLimitExceededError')
  expect(error.shortMessage).toBe('RLP depth limit of `3` exceeded.')
})

test('SizeOverflowError', () => {
  const error = new SizeOverflowError({ givenSize: 33, maxSize: 32 })
  expect(error).toBeInstanceOf(BaseError)
  expect(error.name).toBe('SizeOverflowError')
  expect(error.shortMessage).toBe(
    'Size cannot exceed 32 bytes. Given size: 33 bytes.',
  )
})
