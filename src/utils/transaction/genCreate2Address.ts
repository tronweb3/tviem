import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Hex } from '../../types/misc.js'
import { type PadHexErrorType, padHex } from '../data/pad.js'
import { hexToBytes } from '../encoding/toBytes.js'
import { type Keccak256ErrorType, keccak256 } from '../hash/keccak256.js'

/** Strips an optional `0x` prefix. */
function strip0x(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value
}

export type GenCreate2AddressParameters = {
  /** Creating contract address, TRON hex (`41…`, bare or `0x`). */
  creatorAddress: string
  /**
   * Salt (bare or `0x` hex), left-padded to a 32-byte word; longer values
   * throw.
   */
  salt: string
} & (
  | {
      /** Contract init code (bare or `0x` hex). */
      bytecode: string
      bytecodeHash?: undefined
    }
  | {
      bytecode?: undefined
      /** keccak256 digest of the contract init code (bare or `0x` hex). */
      bytecodeHash: string
    }
)

export type GenCreate2AddressErrorType =
  | BaseErrorType
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
 * Pass exactly one of `bytecode` (hashed here) or `bytecodeHash` (a
 * precomputed 32-byte keccak256 digest of the init code).
 *
 * @returns Contract address in TRON hex form (`41…`, 42 hex chars).
 */
export function genCreate2Address(
  parameters: GenCreate2AddressParameters,
): string {
  const { creatorAddress, salt, bytecode, bytecodeHash } = parameters
  if ((bytecode === undefined) === (bytecodeHash === undefined))
    throw new BaseError(
      'Cannot derive a CREATE2 address: pass exactly one of bytecode or bytecodeHash.',
    )
  let initCodeHash: string
  if (bytecodeHash !== undefined) {
    initCodeHash = strip0x(bytecodeHash)
    // A wrong-size digest would shift every byte after it in the 85-byte
    // preimage and still hash to a plausible-looking address.
    if (initCodeHash.length !== 64)
      throw new BaseError(
        `Invalid bytecodeHash: ${initCodeHash.length} hex chars. Expected a 32-byte (64 hex char) keccak256 digest of the init code.`,
      )
  } else {
    initCodeHash = strip0x(
      keccak256(hexToBytes(`0x${strip0x(bytecode!)}` as Hex), 'hex'),
    )
  }
  const salt32 = strip0x(padHex(`0x${strip0x(salt)}` as Hex, { size: 32 }))
  const hash = keccak256(
    hexToBytes(`0x${strip0x(creatorAddress)}${salt32}${initCodeHash}` as Hex),
    'hex',
  )
  return `41${hash.slice(-40)}`
}
