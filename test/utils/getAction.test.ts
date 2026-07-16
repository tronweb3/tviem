import { expect, test, vi } from 'vitest'

import { getAction } from '../../src/utils/getAction.js'

function myAction(_client: any, params: { value: number }) {
  return params.value
}

test('returns the implicit (by function name) action off the client', () => {
  const override = vi.fn(() => 42)
  const client = { myAction: override }
  const action = getAction(client, myAction, 'someOtherName')
  expect(action({ value: 1 })).toBe(42)
  expect(override).toHaveBeenCalledWith({ value: 1 })
})

test('returns the explicit (by passed name) action off the client', () => {
  const override = vi.fn(() => 7)
  // Simulates a minified function name that no longer matches the client key.
  const client = { writeContract: override }
  const action = getAction(client, myAction, 'writeContract')
  expect(action({ value: 1 })).toBe(7)
  expect(override).toHaveBeenCalledWith({ value: 1 })
})

test('falls back to the tree-shakable action bound to the client', () => {
  const client = {}
  const action = getAction(client, myAction, 'myAction')
  expect(action({ value: 99 })).toBe(99)
})

test('prefers the implicit name over the explicit name', () => {
  const implicit = vi.fn(() => 'implicit')
  const explicit = vi.fn(() => 'explicit')
  const client = { myAction: implicit, explicitKey: explicit }
  const action = getAction(client, myAction, 'explicitKey')
  expect(action({ value: 0 })).toBe('implicit')
  expect(explicit).not.toHaveBeenCalled()
})
