import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { AddressInput } from '../../types/address.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import {
  type NormalizeAddressErrorType,
  normalizeAddress,
} from '../address/normalize.js'
import { type HexToBytesErrorType, hexToBytes } from '../encoding/toBytes.js'
import { type BytesToHexErrorType, bytesToHex } from '../encoding/toHex.js'
import { type Keccak256ErrorType, keccak256 } from '../hash/keccak256.js'

/** Strips an optional `0x` prefix. */
function strip0x(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value
}

export type GenContractAddressErrorType =
  | BaseErrorType
  | BytesToHexErrorType
  | HexToBytesErrorType
  | NormalizeAddressErrorType
  | Keccak256ErrorType
  | ErrorType

/**
 * Derives the address of a contract deployed by a `CreateSmartContract`
 * transaction: `41` followed by the low 20 bytes of
 * `keccak256(txId ‖ ownerAddress)`, where both inputs are the raw hash and
 * `41`-prefixed owner bytes.
 *
 * @param txId Deploying transaction id (32 bytes, bare or `0x`-prefixed hex).
 * @param ownerAddress Deployer address (any TRON address form, or bytes —
 *   see `normalizeAddress`).
 * @returns Contract address in TRON hex form (`41…`, 42 hex chars).
 */
export function genContractAddress(
  txId: string,
  ownerAddress: AddressInput | ByteArray,
): string {
  const txHash = strip0x(txId)
  // The txID is the FIRST component of the 53-byte preimage: a wrong-size
  // value shifts every owner byte after it and still hashes to a
  // plausible-looking `41…` address.
  if (txHash.length !== 64)
    throw new BaseError(
      `Invalid txId: ${txHash.length} hex chars. Expected a 32-byte (64 hex char) transaction id.`,
    )
  // Normalizing pins the owner to the validated 21-byte `41…` form and
  // accepts every TRON address form the rest of the SDK does.
  const owner = bytesToHex(normalizeAddress(ownerAddress)).slice(2)
  const hash = keccak256(hexToBytes(`0x${txHash}${owner}` as Hex), 'hex')
  return `41${hash.slice(-40)}`
}
