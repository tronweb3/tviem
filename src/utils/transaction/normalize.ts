import type { ErrorType } from '../../errors/utils.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import {
  type NormalizeAddressErrorType,
  normalizeAddress,
} from '../address/normalize.js'
import {
  type AssertHexBytesErrorType,
  assertHexBytes,
  isHex,
} from '../data/isHex.js'
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
  | AssertHexBytesErrorType
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
 * Hex must denote a whole number of bytes: an odd nibble count throws
 * `InvalidHexValueError` rather than being padded, in both hex modes.
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
  // Auto mode: only a `0x`-prefixed hex string is hex.
  if (visible !== false && !isHex(value)) return stringToBytes(value)
  const hex = (value.startsWith('0x') ? value : `0x${value}`) as Hex
  // Whole-byte hex only. `hexToBytes` left-pads an odd nibble count, which
  // silently rewrites the caller's bytes: a truncated paste or an unpadded
  // `toString(16)` comes back with a nibble invented and every byte after it
  // shifted — and these bytes are serialized, hashed into the txID and signed.
  // A write-once account id that lost a nibble would still measure 8 bytes.
  assertHexBytes(hex)
  return hexToBytes(hex)
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
