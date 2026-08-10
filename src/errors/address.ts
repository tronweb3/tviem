import { BaseError } from './base.js'

/**
 * The longest valid address form: `0x41` + 21 bytes = 44 characters. Anything
 * longer cannot be a mistyped address.
 */
const maxAddressLength = 44

/** How much of an over-long value is kept — enough to see which form it is. */
const redactedPrefixLength = 6

export type InvalidAddressErrorType = InvalidAddressError & {
  name: 'InvalidAddressError'
}
export class InvalidAddressError extends BaseError {
  constructor({ address }: { address: string }) {
    // A value longer than any address form is not a typo — it may be a private
    // key or mnemonic passed where an address was expected. Echoing it in full
    // would put the secret in the error message, and from there into logs and
    // error reports, so only its head and length are shown.
    const redacted = address.length > maxAddressLength
    const shown = redacted
      ? `${address.slice(0, redactedPrefixLength)}…`
      : address
    super(`Address "${shown}" is invalid.`, {
      metaMessages: [
        '- Address must be a "T"-prefixed Base58Check string of 34 characters, or a "41"-prefixed hex value of 21 bytes (42 hex characters).',
        '- Base58Check address must match its double-SHA256 checksum.',
        ...(redacted
          ? [
              `- The value is ${address.length} characters long — too long to be an address in any form, so it is shown truncated in case it holds key material.`,
            ]
          : []),
      ],
      name: 'InvalidAddressError',
    })
  }
}
