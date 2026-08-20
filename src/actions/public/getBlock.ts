import type { Client } from '../../clients/createClient.js'
import type { RequestErrorType } from '../../clients/transports/http.js'
import { BaseError, type BaseErrorType } from '../../errors/base.js'
import {
  BlockNotFoundError,
  type BlockNotFoundErrorType,
} from '../../errors/rpc.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Block } from '../../types/block.js'
import type { ToBase58ErrorType } from '../../utils/address/toBase58.js'
import { formatBlock, isEmptyResponse, type RawBlock } from './getNowBlock.js'

export type GetBlockParameters = {
  /** The block number to fetch. */
  blockNumber: bigint | number
  /**
   * Read solidified state from the SolidityNode instead of the FullNode's
   * latest state. Solidification trails the chain head, so a block close
   * enough to the head is not there yet. @default false
   */
  confirmed?: boolean | undefined
}
export type GetBlockReturnType = Block

export type GetBlockErrorType =
  | BaseErrorType
  | BlockNotFoundErrorType
  | RequestErrorType
  | ToBase58ErrorType
  | ErrorType

/**
 * Fetches a block by number via `getblockbynum` — FullNode by default,
 * SolidityNode with `confirmed: true`.
 *
 * @param client The Client to use.
 * @param parameters `blockNumber` — the block number to fetch.
 * @returns The formatted block.
 * @throws {BlockNotFoundError} If the node returns an empty body (unknown block).
 */
export async function getBlock(
  client: Client,
  { blockNumber, confirmed }: GetBlockParameters,
): Promise<GetBlockReturnType> {
  // `Number()` folds bigints in, so one check rejects negatives, fractions,
  // `NaN` and infinities before anything reaches the node.
  const num = Number(blockNumber)
  if (!Number.isInteger(num) || num < 0)
    throw new BaseError(
      `Invalid blockNumber: ${blockNumber}. Expected a non-negative integer block height.`,
    )
  const response = await client.request<RawBlock>({
    node: confirmed ? 'solidity' : 'full',
    path: 'getblockbynum',
    method: 'POST',
    body: { num },
  })
  if (isEmptyResponse(response)) throw new BlockNotFoundError({ blockNumber })
  return formatBlock(response)
}
