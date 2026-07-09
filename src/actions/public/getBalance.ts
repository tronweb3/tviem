// TRON-specific, clean-room implementation for @tronweb3/omni (RD-1).
import type { Client } from '../../clients/createClient.js'
import type { Address } from '../../types/address.js'
import { toHex } from '../../utils/address/toHex.js'

export type GetBalanceParameters = {
  /** The Base58Check address to read the TRX balance of. */
  address: Address
}
export type GetBalanceReturnType = bigint

type GetAccountResponse = {
  /** Balance in SUN. Absent for a non-existent account (`{}`). */
  balance?: number | string | undefined
}

/**
 * Reads the TRX balance (in SUN) of an account.
 *
 * Queries `getaccount` on the SolidityNode (confirmed state). A non-existent
 * account returns an empty `{}`, which maps to `0n` — no success assertion is
 * made (an empty body is a valid "zero balance" answer, not an error).
 *
 * @param client The Client to use.
 * @param parameters `address` — the Base58Check address to query.
 * @returns The balance in SUN.
 */
export async function getBalance(
  client: Client,
  { address }: GetBalanceParameters,
): Promise<GetBalanceReturnType> {
  const response = await client.request<GetAccountResponse>({
    node: 'solidity',
    path: 'getaccount',
    method: 'POST',
    body: { address: toHex(address) },
  })
  return BigInt(response?.balance ?? 0)
}
