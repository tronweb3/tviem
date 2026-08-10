/**
 * Default `feeLimit` for contract writes: 150 TRX (in SUN, 1 TRX = 1e6 SUN).
 * `feeLimit` is part of the signed `raw_data`, so it must be chosen at build
 * time; a write may override it (e.g. after `estimateEnergy`).
 *
 * @remarks Consumed by the write pipeline (`writeContract`).
 */
export const defaultFeeLimit = 150_000_000n
