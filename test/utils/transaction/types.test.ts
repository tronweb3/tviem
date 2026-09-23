import { expect, test } from 'vitest'
import { BaseError } from '../../../src/errors/base.js'
import {
  type ResourceCodeName,
  resourceCodeOf,
} from '../../../src/utils/transaction/types.js'

test('resolves the two staking resource names to their wire values', () => {
  expect(resourceCodeOf('BANDWIDTH')).toBe(0)
  expect(resourceCodeOf('ENERGY')).toBe(1)
})

test('rejects a name the enum does not carry', () => {
  for (const name of ['TRON_POWER', 'energy', '', 'Bandwidth']) {
    const error = (() => {
      try {
        resourceCodeOf(name as ResourceCodeName)
        return undefined
      } catch (e) {
        return e as Error
      }
    })()
    expect(error).toBeInstanceOf(BaseError)
    expect(error?.message).toContain(`Invalid staking resource "${name}"`)
  }
})

// `ResourceCode` is a plain object literal, so indexing it with an inherited
// `Object.prototype` member name yields a function (or the prototype itself),
// never `undefined` — and the "throws on anything else" promise was bypassed
// for exactly the names an untyped caller can most easily produce. The
// garbage then failed deeper, inside serialization, with an int64 error that
// named the wrong layer.
test.each([
  'constructor',
  'toString',
  'valueOf',
  'hasOwnProperty',
  '__proto__',
])('rejects the inherited Object.prototype member name %s', (name) => {
  const error = (() => {
    try {
      resourceCodeOf(name as ResourceCodeName)
      return undefined
    } catch (e) {
      return e as Error
    }
  })()
  expect(error).toBeInstanceOf(BaseError)
  expect(error?.message).toContain(`Invalid staking resource "${name}"`)
})
