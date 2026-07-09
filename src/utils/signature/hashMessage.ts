// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { ErrorType } from '../../errors/utils.js'
import type { ByteArray, Hex, SignableMessage } from '../../types/misc.js'
import { type ConcatErrorType, concat } from '../data/concat.js'
import {
  type HexToBytesErrorType,
  hexToBytes,
  type StringToBytesErrorType,
  stringToBytes,
} from '../encoding/toBytes.js'
import { type Keccak256ErrorType, keccak256 } from '../hash/keccak256.js'

/** TIP-191 message prefix (`0x19` ++ `"TRON Signed Message:\n"`). */
export const presignMessagePrefix = '\x19TRON Signed Message:\n'

export type HashMessageErrorType =
  | ConcatErrorType
  | HexToBytesErrorType
  | StringToBytesErrorType
  | Keccak256ErrorType
  | ErrorType

/**
 * Computes the TIP-191 message digest:
 * `keccak256("\x19TRON Signed Message:\n" ++ len ++ message)`,
 * where `len` is the decimal byte-length of `message` as ASCII.
 *
 * A `string` is encoded as UTF-8 (length measured in bytes, not code points);
 * pass `{ raw }` to hash arbitrary bytes as-is.
 *
 * @param message The message to hash — a UTF-8 string or `{ raw: Hex | bytes }`.
 * @returns The `0x`-prefixed 32-byte digest.
 *
 * @example
 * hashMessage('hello @tronweb3/omni')
 * // '0x068a2c93df26c5f19fb1d6b74abe50efc69cbff8b70a9cc9b915058e0ed9a18e'
 */
export function hashMessage<to extends 'hex' | 'bytes' = 'hex'>(
  message: SignableMessage,
  to_?: to | undefined,
): to extends 'bytes' ? ByteArray : Hex {
  const messageBytes = (() => {
    if (typeof message === 'string') return stringToBytes(message)
    if (typeof message.raw === 'string') return hexToBytes(message.raw)
    return message.raw
  })()
  const prefixBytes = stringToBytes(
    `${presignMessagePrefix}${messageBytes.length}`,
  )
  return keccak256(
    concat([prefixBytes, messageBytes]),
    to_ ?? 'hex',
  ) as to extends 'bytes' ? ByteArray : Hex
}
