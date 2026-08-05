import type { Client } from '../../clients/createClient.js'
import type { RequestErrorType } from '../../clients/transports/http.js'
import type { ErrorType } from '../../errors/utils.js'
import type { TronHexAddress } from '../../types/address.js'
import type { Hex } from '../../types/misc.js'
import type {
  TransactionInfo,
  TransactionLog,
  TransactionStatus,
} from '../../types/transaction.js'
import {
  type ToBase58ErrorType,
  toBase58,
} from '../../utils/address/toBase58.js'
import { isEmptyResponse } from './getNowBlock.js'

export type GetTransactionInfoParameters = {
  /** The transaction id (64 hex chars, no `0x` prefix). */
  hash: string
}
export type GetTransactionInfoReturnType = TransactionInfo | null

export type GetTransactionInfoErrorType =
  | RequestErrorType
  | ToBase58ErrorType
  | ErrorType

type RawReceipt = {
  energy_usage?: number | undefined
  energy_usage_total?: number | undefined
  energy_fee?: number | undefined
  net_usage?: number | undefined
  net_fee?: number | undefined
  result?: string | undefined
}

type RawLog = {
  address?: string | undefined
  topics?: readonly string[] | undefined
  data?: string | undefined
}

type RawTransactionInfo = {
  id?: string | undefined
  blockNumber?: number | undefined
  blockTimeStamp?: number | undefined
  fee?: number | undefined
  contractResult?: readonly string[] | undefined
  contract_address?: string | undefined
  receipt?: RawReceipt | undefined
  log?: readonly RawLog[] | undefined
  /** Top-level execution result, e.g. `'FAILED'` for a reverted contract call. */
  result?: string | undefined
}

/**
 * Maps a receipt's `receipt.result` (+ top-level `result`) to a coarse status.
 *
 * - `receipt.result === 'SUCCESS'` → `'success'`.
 * - any other `receipt.result` (`REVERT`, `OUT_OF_ENERGY`, `FAILED`, …) →
 *   `'reverted'`.
 * - no `receipt.result` (a plain TRX transfer) → `'success'` unless the
 *   top-level `result` is `'FAILED'`.
 */
function mapStatus(
  receiptResult: string | undefined,
  topResult: string | undefined,
): TransactionStatus {
  if (receiptResult === 'SUCCESS') return 'success'
  if (receiptResult) return 'reverted'
  return topResult === 'FAILED' ? 'reverted' : 'success'
}

function formatLog(log: RawLog): TransactionLog {
  return {
    // The null address — '41' alone is not a valid address form.
    address: toBase58(
      (log.address ??
        '410000000000000000000000000000000000000000') as TronHexAddress,
    ),
    topics: (log.topics ?? []).map((topic) => `0x${topic}` as Hex),
    data: `0x${log.data ?? ''}` as Hex,
  }
}

/**
 * Fetches a transaction's receipt / execution info from the SolidityNode via
 * `gettransactioninfobyid` (confirmed state). Addresses that come out of the
 * receipt (`contract_address`, `log[].address`) are converted back to
 * Base58Check; `topics`/`data` are `0x`-prefixed.
 *
 * @param client The Client to use.
 * @param parameters `hash` — the transaction id.
 * @returns The formatted receipt, or `null` if the transaction is not yet
 *   packed (`waitForTransactionReceipt` polls on this).
 */
export async function getTransactionInfo(
  client: Client,
  { hash }: GetTransactionInfoParameters,
): Promise<GetTransactionInfoReturnType> {
  const response = await client.request<RawTransactionInfo>({
    node: 'solidity',
    path: 'gettransactioninfobyid',
    method: 'POST',
    body: { value: hash },
  })
  if (isEmptyResponse(response)) return null

  const receipt = response.receipt ?? {}
  return {
    id: response.id ?? hash,
    blockNumber: BigInt(response.blockNumber ?? 0),
    blockTimeStamp: BigInt(response.blockTimeStamp ?? 0),
    status: mapStatus(receipt.result, response.result),
    fee: BigInt(response.fee ?? 0),
    energyUsage: BigInt(receipt.energy_usage ?? 0),
    energyUsageTotal: BigInt(receipt.energy_usage_total ?? 0),
    energyFee: BigInt(receipt.energy_fee ?? 0),
    netUsage: BigInt(receipt.net_usage ?? 0),
    netFee: BigInt(receipt.net_fee ?? 0),
    contractResult: response.contractResult ?? [],
    ...(response.contract_address
      ? {
          contractAddress: toBase58(
            response.contract_address as TronHexAddress,
          ),
        }
      : {}),
    logs: (response.log ?? []).map(formatLog),
  }
}
