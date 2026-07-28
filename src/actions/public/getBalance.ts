// TRON-specific, clean-room implementation for @tronweb3/omni (RD-1).
import type { Client } from '../../clients/createClient.js'
import { IntegerOutOfRangeError } from '../../errors/encoding.js'
import type { Address } from '../../types/address.js'
import { toHex } from '../../utils/address/toHex.js'

export type GetBalanceParameters = {
  /** The Base58Check address to read the TRX balance of. */
  address: Address
}
export type GetBalanceReturnType = bigint

type GetAccountResponse = {
  /** Balance in SUN. Absent for a non-existent account (`{}`). */
  balance?: number | string | bigint | undefined
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
  const balance = response?.balance ?? 0
  // The transport re-materializes unsafe integer literals as bigint where the
  // engine allows; on engines where it cannot, an unsafe number here has
  // ALREADY lost precision in JSON.parse — refuse to return it as if exact.
  if (typeof balance === 'number' && !Number.isSafeInteger(balance))
    throw new IntegerOutOfRangeError({
      max: String(Number.MAX_SAFE_INTEGER),
      min: '0',
      value: String(balance),
    })
  return BigInt(balance)
}
