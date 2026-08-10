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

// A `0x41`-prefixed hex address is 44 characters — the longest valid form, so
// it must still be echoed in full to stay debuggable.
test('InvalidAddressError echoes a value at the longest valid length', () => {
  const address = `0x41${'0'.repeat(40)}`
  expect(address).toHaveLength(44)
  expect(new InvalidAddressError({ address }).message).toContain(
    `Address "${address}" is invalid.`,
  )
})

// A private key pasted where an address was expected must not end up in the
// error message (and from there in logs / error reports).
test('InvalidAddressError redacts a value too long to be an address', () => {
  const privateKey = `0x${'ab'.repeat(32)}` // 66 chars
  const error = new InvalidAddressError({ address: privateKey })
  expect(error.message).toContain('Address "0xabab…" is invalid.')
  expect(error.message).not.toContain(privateKey)
  expect(error.message).not.toContain('ab'.repeat(4))
  expect(error.message).toContain('66 characters long')
})
