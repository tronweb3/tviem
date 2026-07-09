const size = 256
let index = size
let buffer: string

/**
 * Generates a short, monotonically-advancing base16 id.
 *
 * A fresh random buffer is regenerated whenever it is exhausted; each call
 * returns the next `length`-character window. Used to tag clients and
 * transports for request de-duplication.
 */
export function uid(length = 11) {
  if (!buffer || index + length > size * 2) {
    buffer = ''
    index = 0
    for (let i = 0; i < size; i++) {
      buffer += ((256 + Math.random() * 256) | 0).toString(16).substring(1)
    }
  }
  return buffer.substring(index, index++ + length)
}
