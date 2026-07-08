import type { ErrorType } from '../../errors/utils.js'
import type { Hex } from '../../types/misc.js'
import { hexToBytes } from '../encoding/toBytes.js'
import { type Keccak256ErrorType, keccak256 } from '../hash/keccak256.js'

/** Strips an optional `0x` prefix. */
function strip0x(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value
}

export type GenContractAddressErrorType = Keccak256ErrorType | ErrorType

/**
 * Derives the address of a contract deployed by a `CreateSmartContract`
 * transaction: `41` followed by the low 20 bytes of
 * `keccak256(txId ‖ ownerAddress)`, where both inputs are the raw hash and
 * `41`-prefixed owner bytes.
 *
 * @param txId Deploying transaction id (bare or `0x`-prefixed hex).
 * @param ownerAddress Deployer address, TRON hex (`41…`, bare or `0x`).
 * @returns Contract address in TRON hex form (`41…`, 42 hex chars).
 */
export function genContractAddress(txId: string, ownerAddress: string): string {
  const hash = keccak256(
    hexToBytes(`0x${strip0x(txId)}${strip0x(ownerAddress)}` as Hex),
    'hex',
  )
  return `41${hash.slice(-40)}`
}
