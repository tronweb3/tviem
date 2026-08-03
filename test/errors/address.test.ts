import { expect, test } from 'vitest'

import { InvalidAddressError } from '../../src/errors/address.js'

test('InvalidAddressError', () => {
  expect(
    new InvalidAddressError({
      address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6X',
    }),
  ).toMatchInlineSnapshot(`
    [InvalidAddressError: Address "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6X" is invalid.

    - Address must be a "T"-prefixed Base58Check string of 34 characters, or a "41"-prefixed hex value of 21 bytes (42 hex characters).
    - Base58Check address must match its double-SHA256 checksum.

    Version: @tronweb3/tviem@1.0.0-beta.1]
  `)
})
