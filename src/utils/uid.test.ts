import { expect, test } from 'vitest'

import { uid } from './uid.js'

test('default length is 11', () => {
  expect(uid()).toHaveLength(11)
})

test('respects a custom length', () => {
  expect(uid(4)).toHaveLength(4)
})

test('advances between calls', () => {
  const a = uid()
  const b = uid()
  expect(a).not.toBe(b)
})

test('emits base16 characters', () => {
  expect(uid(32)).toMatch(/^[0-9a-f]+$/)
})
