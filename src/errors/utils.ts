import type { Address } from 'abitype'

export type ErrorType<name extends string = 'Error'> = Error & { name: name }
export type AbortErrorType = ErrorType<'AbortError'>

export const getContractAddress = (address: Address) => address

export function getAbortError(signal?: AbortSignal | undefined) {
  if (signal?.reason) return signal.reason
  if (typeof DOMException === 'function')
    return new DOMException('This operation was aborted', 'AbortError')
  const error = new Error('This operation was aborted') as AbortErrorType
  error.name = 'AbortError'
  return error
}

export function isAbortError(error: unknown): error is AbortErrorType {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  )
}

/**
 * Returns the URL with any embedded basic-auth credentials stripped, so a URL
 * like `https://user:pass@host` renders into an error message without the
 * `user:pass` part. Returns the input unchanged if it does not parse as a URL.
 */
export const getUrl = (url: string) => {
  try {
    const parsed = new URL(url)
    if (!parsed.username && !parsed.password) return url
    parsed.username = ''
    parsed.password = ''
    return parsed.toString()
  } catch {
    return url
  }
}
