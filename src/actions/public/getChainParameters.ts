// TRON-specific, clean-room implementation for @tronweb3/tviem (RD-4).
import type { Client } from '../../clients/createClient.js'

export type GetChainParametersReturnType = Record<string, bigint>

type ChainParameterEntry = {
  key: string
  /** Absent for a zero-valued parameter (maps to `0n`). */
  value?: number | string | undefined
}

type GetChainParametersResponse = {
  chainParameter?: readonly ChainParameterEntry[] | undefined
}

/**
 * Fetches the chain's dynamic parameters from the FullNode via
 * `getchainparameters`, as a `key → bigint` map. Parameters the node returns
 * without a `value` (zero-valued) map to `0n`.
 *
 * @param client The Client to use.
 * @returns A map of parameter key to its (SUN / integer) value.
 */
export async function getChainParameters(
  client: Client,
): Promise<GetChainParametersReturnType> {
  const response = await client.request<GetChainParametersResponse>({
    node: 'full',
    path: 'getchainparameters',
    method: 'POST',
    body: {},
  })
  const parameters: Record<string, bigint> = {}
  for (const { key, value } of response?.chainParameter ?? [])
    parameters[key] = BigInt(value ?? 0)
  return parameters
}

/** Convenience getter: the energy price (SUN per unit of energy), or `0n`. */
export function getEnergyFee(parameters: GetChainParametersReturnType): bigint {
  return parameters.getEnergyFee ?? 0n
}

/** Convenience getter: the bandwidth price (SUN per byte), or `0n`. */
export function getTransactionFee(
  parameters: GetChainParametersReturnType,
): bigint {
  return parameters.getTransactionFee ?? 0n
}
