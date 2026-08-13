import type { Client } from '../../clients/createClient.js'
import type { RequestErrorType } from '../../clients/transports/http.js'
import { TronRpcError, type TronRpcErrorType } from '../../errors/rpc.js'
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
  /**
   * Read confirmed (solidified) state from the SolidityNode; pass `false` to
   * read the FullNode's latest (unconfirmed) state instead. @default true
   */
  confirmed?: boolean | undefined
}
export type GetTransactionInfoReturnType = TransactionInfo | null

export type GetTransactionInfoErrorType =
  | RequestErrorType
  | ToBase58ErrorType
  | TronRpcErrorType
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
  /** EVM-form address: bare 20-byte hex, no `41` prefix, no `0x` prefix. */
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
    // The node emits log addresses in EVM form (bare 20-byte hex, no `41`
    // prefix); `0x`-prefixing also tolerates a 21-byte `41`-prefixed value.
    ...(log.address ? { address: toBase58(`0x${log.address}`) } : {}),
    topics: (log.topics ?? []).map((topic) => `0x${topic}` as Hex),
    data: `0x${log.data ?? ''}` as Hex,
  }
}

/**
 * Fetches a transaction's receipt / execution info via
 * `gettransactioninfobyid` — SolidityNode (confirmed state) by default,
 * FullNode with `confirmed: false`. The returned `logs` are the receipt's raw
 * event entries — the per-transaction counterpart to `getLogs` (whose
 * `eth_getLogs` filter has no transaction-hash dimension); decode them with
 * `decodeEventLog` when an ABI is at hand. Addresses that come out of the
 * receipt (`contract_address` as TRON 41-hex, `log[].address` as EVM-form
 * bare hex) are converted back to Base58Check; `topics`/`data` are
 * `0x`-prefixed.
 *
 * @param client The Client to use.
 * @param parameters `hash` — the transaction id.
 * @returns The formatted receipt, or `null` if the transaction is not yet
 *   packed (`waitForTransactionReceipt` polls on this).
 */
export async function getTransactionInfo(
  client: Client,
  { confirmed, hash }: GetTransactionInfoParameters,
): Promise<GetTransactionInfoReturnType> {
  const response = await client.request<RawTransactionInfo>({
    node: (confirmed ?? true) ? 'solidity' : 'full',
    path: 'gettransactioninfobyid',
    method: 'POST',
    body: { value: hash },
  })
  if (isEmptyResponse(response)) return null

  // The resource fields below legitimately arrive omitted — java-tron's JSON
  // drops proto3-default (zero) values — so `?? 0` reconstructs them.
  // `blockNumber` is held to more: a packed transaction lives in a positive
  // block, so anything else — absent, `null`, 0, negative, or a non-number
  // (e.g. the string "0" a spec-conformant proto3-JSON re-serializer emits
  // for an int64 default) — is a malformed response, and coercing it would
  // hand a confirmation counter a receipt that looks `head` blocks deep.
  // (`blockTimeStamp` stays defaulted: nothing branches on it, so a malformed
  // value corrupts display, not control flow.)
  const { blockNumber } = response
  if (
    typeof blockNumber !== 'number' ||
    !Number.isSafeInteger(blockNumber) ||
    blockNumber <= 0
  )
    throw new TronRpcError(
      'The node returned a transaction receipt without a valid blockNumber.',
      { metaMessages: ['Path: gettransactioninfobyid'] },
    )

  const receipt = response.receipt ?? {}
  return {
    id: response.id ?? hash,
    blockNumber: BigInt(blockNumber),
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
