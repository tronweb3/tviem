import type { Client } from '../../clients/createClient.js'
import type { RequestErrorType } from '../../clients/transports/http.js'
import {
  IntegerOutOfRangeError,
  type IntegerOutOfRangeErrorType,
} from '../../errors/encoding.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Address } from '../../types/address.js'
import { type ToHexErrorType, toHex } from '../../utils/address/toHex.js'

export type GetBalanceParameters = {
  /** The Base58Check address to read the TRX balance of. */
  address: Address
  /**
   * Read confirmed (solidified) state from the SolidityNode; pass `false` to
   * read the FullNode's latest (unconfirmed) state instead. @default true
   */
  confirmed?: boolean | undefined
}
export type GetBalanceReturnType = bigint

export type GetBalanceErrorType =
  | IntegerOutOfRangeErrorType
  | RequestErrorType
  | ToHexErrorType
  | ErrorType

type GetAccountResponse = {
  /** Balance in SUN. Absent for a non-existent account (`{}`). */
  balance?: number | string | bigint | undefined
}

/**
 * Reads the TRX balance (in SUN) of an account.
 *
 * Queries `getaccount` — SolidityNode (confirmed state) by default, FullNode
 * with `confirmed: false`. A non-existent
 * account returns an empty `{}`, which maps to `0n` — no success assertion is
 * made (an empty body is a valid "zero balance" answer, not an error).
 *
 * @param client The Client to use.
 * @param parameters `address` — the Base58Check address to query.
 * @returns The balance in SUN.
 */
export async function getBalance(
  client: Client,
  { address, confirmed }: GetBalanceParameters,
): Promise<GetBalanceReturnType> {
  const response = await client.request<GetAccountResponse>({
    node: (confirmed ?? true) ? 'solidity' : 'full',
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
