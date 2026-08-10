import { expect, test } from 'vitest'
import { defaultFeeLimit } from '../../src/constants/transaction.js'

test('defaultFeeLimit is 150 TRX in SUN', () => {
  expect(defaultFeeLimit).toBe(150_000_000n)
})
