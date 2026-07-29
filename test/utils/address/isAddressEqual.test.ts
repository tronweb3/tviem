// TRON-specific, clean-room tests for @tronweb3/tviem.
import { describe, expect, test } from 'vitest'

import { InvalidAddressError } from '../../../src/errors/address.js'
import { isAddressEqual } from '../../../src/utils/address/isAddressEqual.js'

describe('isAddressEqual', () => {
  test('§2.1: isAddressEqual(V2.base58, V2.evm0x) === true', () => {
    expect(
      isAddressEqual(
        'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
        '0x2b5ad5c4795c026514f8317c7a215e218dccd6cf',
      ),
    ).toBe(true)
  })

  test('equal across all form pairs', () => {
    expect(
      isAddressEqual(
        'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
        '412b5ad5c4795c026514f8317c7a215e218dccd6cf',
      ),
    ).toBe(true)
    expect(
      isAddressEqual(
        '412b5ad5c4795c026514f8317c7a215e218dccd6cf',
        '0x2b5ad5c4795c026514f8317c7a215e218dccd6cf',
      ),
    ).toBe(true)
    expect(
      isAddressEqual(
        '0x412b5ad5c4795c026514f8317c7a215e218dccd6cf',
        'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
      ),
    ).toBe(true)
  })

  test('different addresses are not equal (any form)', () => {
    expect(
      isAddressEqual(
        'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC',
        'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
      ),
    ).toBe(false)
    expect(
      isAddressEqual(
        'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC',
        '0x2b5ad5c4795c026514f8317c7a215e218dccd6cf',
      ),
    ).toBe(false)
  })

  test('throws InvalidAddressError on invalid input (either side)', () => {
    expect(() =>
      isAddressEqual(
        'T123' as `T${string}`,
        'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
      ),
    ).toThrow(InvalidAddressError)
    expect(() =>
      isAddressEqual(
        'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K',
        'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6X',
      ),
    ).toThrow(InvalidAddressError)
    expect(() =>
      isAddressEqual('' as `T${string}`, 'TDvSsdrNM5eeXNL3czpa6AxLDHZA9nwe9K'),
    ).toThrow(InvalidAddressError)
  })
})
