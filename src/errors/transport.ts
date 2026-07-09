import { BaseError } from './base.js'

export type UrlRequiredErrorType = UrlRequiredError & {
  name: 'UrlRequiredError'
}
/** Thrown when a transport is created without a URL and none can be derived. */
export class UrlRequiredError extends BaseError {
  constructor() {
    super(
      'No URL was provided to the Transport. Please provide a valid node URL to the Transport.',
      {
        docsPath: '/docs/clients/intro',
        name: 'UrlRequiredError',
      },
    )
  }
}
