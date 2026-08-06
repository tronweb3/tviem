import { BaseError } from './base.js'

/**
 * Thrown when a transaction carries a contract type tviem does not support:
 * an unregistered `google.protobuf.Any` type URL, or an unregistered
 * `Transaction.Contract.type` integer or name. Decoding is strict by design —
 * unsupported transactions are refused rather than partially decoded, so a
 * model can never silently misrepresent bytes the SDK does not understand.
 * The raw `Any.value` payload (bare hex), when available, is preserved on
 * the error for inspection.
 */
export type UnknownContractTypeErrorType = UnknownContractTypeError & {
  name: 'UnknownContractTypeError'
}
export class UnknownContractTypeError extends BaseError {
  /** The unsupported contract type: an `Any` type URL or a type integer. */
  type: string | number
  /** The raw `Any.value` payload (bare hex), when available. */
  value?: string | undefined

  constructor({
    type,
    value,
  }: { type: string | number; value?: string | undefined }) {
    super(
      `Contract type ${
        typeof type === 'string' ? `"${type}"` : type
      } is not supported.`,
      {
        metaMessages: value ? [`Any.value (hex): ${value}`] : undefined,
        name: 'UnknownContractTypeError',
      },
    )
    this.type = type
    this.value = value
  }
}
