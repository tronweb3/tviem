import type { ErrorType } from '../../errors/utils.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import {
  type NormalizeAddressErrorType,
  normalizeAddress,
} from '../address/normalize.js'
import { isHex } from '../data/isHex.js'
import { bareHex } from '../encoding/bareHex.js'
import {
  type HexToBytesErrorType,
  hexToBytes,
  type StringToBytesErrorType,
  stringToBytes,
} from '../encoding/toBytes.js'

/**
 * Dual-form ("flex") ACTION-parameter input, e.g. a TRC10 asset name/id:
 * UTF-8 text, hex, or raw bytes — see {@link flex}. This is an action-layer
 * convenience only; the transaction model itself carries such fields as
 * bare hex (java-tron's `visible: false` JSON form).
 */
export type FlexInput = string | Hex | ByteArray

export type { NormalizeAddressErrorType }
// Address fields of every contract message pivot on the same 21-byte
// normalization as the address utils; re-exported here as the transaction
// layer's single entry point.
export { normalizeAddress }

export type FlexErrorType =
  | HexToBytesErrorType
  | StringToBytesErrorType
  | ErrorType

/**
 * Normalizes a dual-form ("flex") value — e.g. a TRC10 `asset_name`, which
 * APIs accept as either plain text or hex depending on `visible` — into the
 * raw bytes that go on the wire.
 *
 * - `visible: true` — the value is plain text, encoded as UTF-8.
 * - `visible: false` — the value is hex (`0x` prefix optional).
 * - `visible` omitted — `0x`-prefixed hex is decoded as hex; any other
 *   string is encoded as UTF-8.
 *
 * `Uint8Array` input is passed through (as a fresh copy) regardless of
 * `visible`.
 *
 * @param value Value to normalize.
 * @param visible Interpretation of string input (see above).
 * @returns Normalized bytes.
 */
export function flex(
  value: FlexInput,
  visible?: boolean | undefined,
): ByteArray {
  if (value instanceof Uint8Array) return Uint8Array.from(value)
  if (visible === true) return stringToBytes(value)
  if (visible === false)
    return hexToBytes((value.startsWith('0x') ? value : `0x${value}`) as Hex)
  if (isHex(value)) return hexToBytes(value)
  return stringToBytes(value)
}

/**
 * Normalizes a dual-form ("flex") action input to the bare lowercase hex
 * the transaction model carries — {@link flex} followed by hex rendering.
 * Actions call this while assembling a contract, so text conveniences
 * (asset names, token ids, URLs) never enter the model un-encoded.
 */
export function flexToHex(value: FlexInput, visible?: boolean): string {
  return bareHex(flex(value, visible))
}
