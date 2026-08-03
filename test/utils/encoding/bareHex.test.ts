import { expect, test } from 'vitest'

import { bareHex } from '../../../src/utils/encoding/bareHex.js'

test('strips an 0x prefix and lowercases string input', () => {
  expect(bareHex('0xDEADbeef')).toBe('deadbeef')
  expect(bareHex('DEADbeef')).toBe('deadbeef')
  expect(bareHex('deadbeef')).toBe('deadbeef')
  expect(bareHex('')).toBe('')
  expect(bareHex('0x')).toBe('')
})

test('renders bytes as bare lowercase hex', () => {
  expect(bareHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe('deadbeef')
  expect(bareHex(new Uint8Array(0))).toBe('')
  expect(bareHex(new Uint8Array([0x00, 0x01]))).toBe('0001')
})
