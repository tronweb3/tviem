import { stringify } from '../utils/stringify.js'

import { BaseError } from './base.js'
import { getUrl } from './utils.js'

export type HttpRequestErrorType = HttpRequestError & {
  name: 'HttpRequestError'
}
/** Thrown when an HTTP request to a node fails (non-2xx status or fetch error). */
export class HttpRequestError extends BaseError {
  body?: { [x: string]: unknown } | { [y: string]: unknown }[] | undefined
  headers?: Headers | undefined
  status?: number | undefined
  url: string

  constructor({
    body,
    cause,
    details,
    headers,
    status,
    url,
  }: {
    body?: { [x: string]: unknown } | { [y: string]: unknown }[] | undefined
    cause?: Error | undefined
    details?: string | undefined
    headers?: Headers | undefined
    status?: number | undefined
    url: string
  }) {
    super('HTTP request failed.', {
      cause,
      details,
      metaMessages: [
        status && `Status: ${status}`,
        `URL: ${getUrl(url)}`,
        body && `Request body: ${stringify(body)}`,
      ].filter(Boolean) as string[],
      name: 'HttpRequestError',
    })
    this.body = body
    this.headers = headers
    this.status = status
    // Store the credential-stripped form: error objects routinely get
    // forwarded to logs/telemetry, so the instance must not retain the
    // `user:pass@` part any more than the message does.
    this.url = getUrl(url)
  }
}

export type TimeoutErrorType = TimeoutError & {
  name: 'TimeoutError'
}
/** Thrown when a request to a node exceeds the configured timeout. */
export class TimeoutError extends BaseError {
  url: string
  constructor({
    body,
    url,
  }: {
    body: { [x: string]: unknown } | { [y: string]: unknown }[]
    url: string
  }) {
    super('The request took too long to respond.', {
      details: 'The request timed out.',
      metaMessages: [`URL: ${getUrl(url)}`, `Request body: ${stringify(body)}`],
      name: 'TimeoutError',
    })
    // Same as HttpRequestError: never retain basic-auth credentials.
    this.url = getUrl(url)
  }
}
