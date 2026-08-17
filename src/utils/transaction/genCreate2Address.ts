import type { ErrorType } from '../../errors/utils.js'
import type { Hex } from '../../types/misc.js'
import { type PadHexErrorType, padHex } from '../data/pad.js'
import { hexToBytes } from '../encoding/toBytes.js'
import { type Keccak256ErrorType, keccak256 } from '../hash/keccak256.js'

/** Strips an optional `0x` prefix. */
function strip0x(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value
}

export type GenCreate2AddressErrorType =
  | Keccak256ErrorType
  | PadHexErrorType
  | ErrorType

/**
 * Derives the address of a contract deployed via the TVM `CREATE2` opcode
 * (TIP-26): `41` followed by the low 20 bytes of
 * `keccak256(creatorAddress ‖ salt ‖ keccak256(bytecode))`, where the creator
 * is the raw `41`-prefixed 21-byte address and the salt a 32-byte word — an
 * 85-byte preimage. TRON's `41`-prefixed creator takes the place of the
 * `ff ‖ address` pair in Ethereum's CREATE2.
 *
 * @param creatorAddress Creating contract address, TRON hex (`41…`, bare or `0x`).
 * @param salt Salt (bare or `0x` hex), left-padded to a 32-byte word; longer
 *   values throw.
 * @param bytecode Contract init code (bare or `0x` hex).
 * @returns Contract address in TRON hex form (`41…`, 42 hex chars).
 */
export function genCreate2Address(
  creatorAddress: string,
  salt: string,
  bytecode: string,
): string {
  const initCodeHash = strip0x(
    keccak256(hexToBytes(`0x${strip0x(bytecode)}` as Hex), 'hex'),
  )
  const salt32 = strip0x(padHex(`0x${strip0x(salt)}` as Hex, { size: 32 }))
  const hash = keccak256(
    hexToBytes(`0x${strip0x(creatorAddress)}${salt32}${initCodeHash}` as Hex),
    'hex',
  )
  return `41${hash.slice(-40)}`
}
