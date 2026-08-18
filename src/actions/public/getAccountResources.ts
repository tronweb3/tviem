import type { Client } from '../../clients/createClient.js'
import type { RequestErrorType } from '../../clients/transports/http.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Address } from '../../types/address.js'
import {
  type AddressToHexErrorType,
  addressToHex,
} from '../../utils/address/addressToHex.js'

export type GetAccountResourcesParameters = {
  /** The Base58Check address to read resource usage/limits of. */
  address: Address
}

/**
 * An account's bandwidth (net), energy and TRON-power (voting) budget, in the
 * asset's own units. Every field is `bigint`; a field absent from the node
 * response (TRON omits zero-valued fields) maps to `0n`.
 */
export type GetAccountResourcesReturnType = {
  /** Free daily bandwidth allowance (`freeNetLimit`). */
  freeNetLimit: bigint
  /** Free daily bandwidth consumed (`freeNetUsed`). */
  freeNetUsed: bigint
  /** Staked bandwidth allowance (`NetLimit`). */
  netLimit: bigint
  /** Staked bandwidth consumed (`NetUsed`). */
  netUsed: bigint
  /** Energy allowance (`EnergyLimit`). */
  energyLimit: bigint
  /** Energy consumed (`EnergyUsed`). */
  energyUsed: bigint
  /** TRON-power (voting) allowance (`tronPowerLimit`). */
  tronPowerLimit: bigint
  /** TRON-power (voting) consumed (`tronPowerUsed`). */
  tronPowerUsed: bigint
  /** Network-wide free bandwidth ceiling (`TotalNetLimit`). */
  totalNetLimit: bigint
  /** Network-wide staked bandwidth weight (`TotalNetWeight`). */
  totalNetWeight: bigint
  /** Network-wide energy ceiling (`TotalEnergyLimit`). */
  totalEnergyLimit: bigint
  /** Network-wide staked energy weight (`TotalEnergyWeight`). */
  totalEnergyWeight: bigint
}

export type GetAccountResourcesErrorType =
  | RequestErrorType
  | AddressToHexErrorType
  | ErrorType

/** Raw `getaccountresource` body; TRON omits zero-valued fields entirely. */
type GetAccountResourceResponse = {
  freeNetLimit?: number | string | undefined
  freeNetUsed?: number | string | undefined
  NetLimit?: number | string | undefined
  NetUsed?: number | string | undefined
  EnergyLimit?: number | string | undefined
  EnergyUsed?: number | string | undefined
  tronPowerLimit?: number | string | undefined
  tronPowerUsed?: number | string | undefined
  TotalNetLimit?: number | string | undefined
  TotalNetWeight?: number | string | undefined
  TotalEnergyLimit?: number | string | undefined
  TotalEnergyWeight?: number | string | undefined
}

/** Coerces a possibly-absent numeric field to `bigint`, defaulting to `0n`. */
function toBigInt(value: number | string | undefined): bigint {
  return BigInt(value ?? 0)
}

/**
 * Reads an account's resource (bandwidth / energy / TRON-power) usage and
 * limits.
 *
 * Queries `getaccountresource` on the FullNode. The node omits zero-valued
 * fields, so every field of the result is defaulted to `0n`. No success
 * assertion is made — an empty body is a valid "no resources" answer.
 *
 * @param client The Client to use.
 * @param parameters `address` — the Base58Check address to query.
 * @returns The account's resource budget, all fields as `bigint`.
 */
export async function getAccountResources(
  client: Client,
  { address }: GetAccountResourcesParameters,
): Promise<GetAccountResourcesReturnType> {
  const response = await client.request<GetAccountResourceResponse>({
    node: 'full',
    path: 'getaccountresource',
    method: 'POST',
    body: { address: addressToHex(address) },
  })
  return {
    freeNetLimit: toBigInt(response?.freeNetLimit),
    freeNetUsed: toBigInt(response?.freeNetUsed),
    netLimit: toBigInt(response?.NetLimit),
    netUsed: toBigInt(response?.NetUsed),
    energyLimit: toBigInt(response?.EnergyLimit),
    energyUsed: toBigInt(response?.EnergyUsed),
    tronPowerLimit: toBigInt(response?.tronPowerLimit),
    tronPowerUsed: toBigInt(response?.tronPowerUsed),
    totalNetLimit: toBigInt(response?.TotalNetLimit),
    totalNetWeight: toBigInt(response?.TotalNetWeight),
    totalEnergyLimit: toBigInt(response?.TotalEnergyLimit),
    totalEnergyWeight: toBigInt(response?.TotalEnergyWeight),
  }
}
