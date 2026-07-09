import type { ErrorType } from '../errors/utils.js'

/** @public */
export type StringifyErrorType = ErrorType

/** `JSON.stringify` that renders `bigint` values as decimal strings. */
export const stringify: typeof JSON.stringify = (value, replacer, space) =>
  JSON.stringify(
    value,
    (key, value_) => {
      const value = typeof value_ === 'bigint' ? value_.toString() : value_
      return typeof replacer === 'function' ? replacer(key, value) : value
    },
    space,
  )
