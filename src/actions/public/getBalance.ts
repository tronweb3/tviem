import type { Client } from '../../clients/createClient.js'
import type { RequestErrorType } from '../../clients/transports/http.js'
import {
  IntegerOutOfRangeError,
  type IntegerOutOfRangeErrorType,
} from '../../errors/encoding.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Address } from '../../types/address.js'
import {
  type AddressToHexErrorType,
  addressToHex,
} from '../../utils/address/addressToHex.js'

export type GetBalanceParameters = {
  /** The Base58Check address to read the TRX balance of. */
  address: Address
  /**
   * Read solidified state from the SolidityNode instead of the FullNode's
   * latest state. Solidified state trails the chain head, so a transfer made
   * moments ago is not reflected there yet. @default false
   */
  confirmed?: boolean | undefined
}
export type GetBalanceReturnType = bigint

export type GetBalanceErrorType =
  | IntegerOutOfRangeErrorType
  | RequestErrorType
  | AddressToHexErrorType
  | ErrorType

type GetAccountResponse = {
  /** Balance in SUN. Absent for a non-existent account (`{}`). */
  balance?: number | string | bigint | undefined
}

/**
 * Reads the TRX balance (in SUN) of an account.
 *
 * Queries `getaccount` — the FullNode's latest state by default, the
 * SolidityNode's solidified state with `confirmed: true`. A non-existent
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
    node: confirmed ? 'solidity' : 'full',
    path: 'getaccount',
    method: 'POST',
    body: { address: addressToHex(address) },
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
