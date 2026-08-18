import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import { type PadHexErrorType, padHex } from '../data/pad.js'
import { hexToBytes } from '../encoding/toBytes.js'
import { type BytesToHexErrorType, bytesToHex } from '../encoding/toHex.js'
import { type Keccak256ErrorType, keccak256 } from '../hash/keccak256.js'

/** Normalizes a hex string (bare or `0x`) or byte array to bare hex. */
function toBareHex(value: string | ByteArray): string {
  if (typeof value !== 'string') return bytesToHex(value).slice(2)
  return value.startsWith('0x') ? value.slice(2) : value
}

export type GetCreate2AddressParameters = {
  /** Creating contract address, TRON form (`41…` hex, bare or `0x`, or bytes). */
  creatorAddress: string | ByteArray
  /**
   * Salt (bare or `0x` hex, or bytes), left-padded to a 32-byte word; longer
   * values throw.
   */
  salt: string | ByteArray
} & (
  | {
      /** Contract init code (bare or `0x` hex, or bytes). */
      bytecode: string | ByteArray
      bytecodeHash?: undefined
    }
  | {
      bytecode?: undefined
      /** keccak256 digest of the contract init code (bare or `0x` hex, or bytes). */
      bytecodeHash: string | ByteArray
    }
)

export type GetCreate2AddressErrorType =
  | BaseErrorType
  | BytesToHexErrorType
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
export function getCreate2Address(
  parameters: GetCreate2AddressParameters,
): string {
  const { creatorAddress, salt, bytecode, bytecodeHash } = parameters
  if ((bytecode === undefined) === (bytecodeHash === undefined))
    throw new BaseError(
      'Cannot derive a CREATE2 address: pass exactly one of bytecode or bytecodeHash.',
    )
  let initCodeHash: string
  if (bytecodeHash !== undefined) {
    initCodeHash = toBareHex(bytecodeHash)
    // A wrong-size digest would shift every byte after it in the 85-byte
    // preimage and still hash to a plausible-looking address.
    if (initCodeHash.length !== 64)
      throw new BaseError(
        `Invalid bytecodeHash: ${initCodeHash.length} hex chars. Expected a 32-byte (64 hex char) keccak256 digest of the init code.`,
      )
  } else {
    initCodeHash = toBareHex(
      keccak256(hexToBytes(`0x${toBareHex(bytecode!)}` as Hex), 'hex'),
    )
  }
  const salt32 = toBareHex(padHex(`0x${toBareHex(salt)}` as Hex, { size: 32 }))
  const hash = keccak256(
    hexToBytes(`0x${toBareHex(creatorAddress)}${salt32}${initCodeHash}` as Hex),
    'hex',
  )
  return `41${hash.slice(-40)}`
}
