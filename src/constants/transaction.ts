/**
 * Default `feeLimit` for contract writes: 150 TRX (in SUN, 1 TRX = 1e6 SUN).
 * `feeLimit` is part of the signed `raw_data`, so it must be chosen at build
 * time; a write may override it (e.g. after `estimateEnergy`).
 *
 * @remarks Consumed by the write pipeline (`writeContract`).
 */
export const defaultFeeLimit = 150_000_000n

/**
 * Default `consume_user_resource_percent` for contract deployments: the
 * caller pays 100% of each call's energy — the value TronWeb's
 * `userFeePercentage` defaults to. Proto3's implicit 0 would mean the
 * DEPLOYER pays every caller's energy.
 *
 * @remarks Consumed by `deployContract`; overridable per deployment.
 */
export const defaultConsumeUserResourcePercent = 100n

/**
 * Default `origin_energy_limit` for contract deployments: 10,000,000 energy
 * per call from the deployer's account — TronWeb's default. java-tron
 * rejects a deployment whose `origin_energy_limit` is not positive, so the
 * field is always written.
 *
 * @remarks Consumed by `deployContract`; overridable per deployment.
 */
export const defaultOriginEnergyLimit = 10_000_000n
