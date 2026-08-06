import { expect, test } from 'vitest'
import { InvalidAddressError } from '../../src/errors/address.js'
import { version } from '../../src/errors/version.js'

test('InvalidAddressError', () => {
  expect(
    new InvalidAddressError({
      address: 'TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLX',
    }),
  ).toMatchObject({
    name: 'InvalidAddressError',
    message: `Address "TA5DvvvmYbS75o3DKtgy2ATAGVHhpFkRLX" is invalid.

- Address must be a "T"-prefixed Base58Check string of 34 characters, or a "41"-prefixed hex value of 21 bytes (42 hex characters).
- Base58Check address must match its double-SHA256 checksum.

Version: @tronweb3/tviem@${version}`,
  })
})
