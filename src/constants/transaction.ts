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

/**
 * Inclusive byte-length bounds java-tron accepts for `account_id`
 * (`TransactionUtil.MIN_ACCOUNT_ID_LEN` / `MAX_ACCOUNT_ID_LEN`): an id of 8
 * bytes passes, 7 does not; 32 passes, 33 does not. Measured on the encoded
 * bytes, never on the input string — the same id is 8 bytes as text and 16
 * characters as hex.
 *
 * The bound is checked in `SetAccountIdActuator.validate()`, so it is a
 * consensus rule rather than a node policy, and it is not stated in any
 * public TRON documentation.
 *
 * @remarks Consumed by `setAccountId`.
 */
export const minAccountIdLength = 8
export const maxAccountIdLength = 32
