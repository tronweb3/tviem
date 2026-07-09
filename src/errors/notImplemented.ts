// TRON-specific, clean-room implementation for @tronweb3/omni.
import { BaseError } from './base.js'

/**
 * Thrown by a feature that is intentionally not wired up yet (a reserved
 * placeholder). Used by `getContract().getEvents` until event support
 * (`getLogs` / `watchEvent`) lands in a later increment.
 */
export type NotImplementedErrorType = NotImplementedError & {
  name: 'NotImplementedError'
}
export class NotImplementedError extends BaseError {
  constructor({
    feature,
    docsPath,
  }: { feature?: string | undefined; docsPath?: string | undefined } = {}) {
    super(`${feature ?? 'This feature'} is not implemented yet.`, {
      docsPath,
      name: 'NotImplementedError',
    })
  }
}
