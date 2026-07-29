import { expect, test } from 'vitest'
import { defaultFeeLimit, zeroAddress } from '../../src/constants/address.js'
import { toHex } from '../../src/utils/address/toHex.js'

test('zeroAddress is 41 followed by 20 zero bytes', () => {
  expect(toHex(zeroAddress)).toBe('410000000000000000000000000000000000000000')
})

test('defaultFeeLimit is 150 TRX in SUN', () => {
  expect(defaultFeeLimit).toBe(150_000_000n)
})
