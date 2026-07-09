// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { Address } from '../types/address.js'

/**
 * The TRON zero address: `0x41` followed by 20 zero bytes, encoded as
 * Base58Check. Used as the default `owner_address` for constant-contract reads
 * (`triggerconstantcontract`) — it never triggers a balance check.
 *
 * @example toHex(zeroAddress) // '410000000000000000000000000000000000000000'
 */
export const zeroAddress: Address = 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb'

/**
 * Default `feeLimit` for contract writes: 150 TRX (in SUN, 1 TRX = 1e6 SUN).
 * `feeLimit` is part of the signed `raw_data`, so it must be chosen at build
 * time; a write may override it (e.g. after `estimateEnergy`).
 *
 * @public
 * @remarks Consumed by the T5 write pipeline (`writeContract`); tagged
 * `@public` so knip does not flag it before the write path is wired.
 */
export const defaultFeeLimit = 150_000_000n
