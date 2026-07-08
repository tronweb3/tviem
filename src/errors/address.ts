import { BaseError } from './base.js'

export type InvalidAddressErrorType = InvalidAddressError & {
  name: 'InvalidAddressError'
}
export class InvalidAddressError extends BaseError {
  constructor({ address }: { address: string }) {
    super(`Address "${address}" is invalid.`, {
      metaMessages: [
        '- Address must be a "T"-prefixed Base58Check string of 34 characters, or a "41"-prefixed hex value of 21 bytes (42 hex characters).',
        '- Base58Check address must match its double-SHA256 checksum.',
      ],
      name: 'InvalidAddressError',
    })
  }
}
