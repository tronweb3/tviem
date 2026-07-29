import type { Client } from '../../clients/createClient.js'
import { BlockNotFoundError } from '../../errors/rpc.js'
import type { Block } from '../../types/block.js'
import { formatBlock, isEmptyResponse, type RawBlock } from './getNowBlock.js'

export type GetBlockParameters = {
  /** The block number to fetch. */
  blockNumber: bigint | number
}
export type GetBlockReturnType = Block

/**
 * Fetches a block by number from the FullNode via `getblockbynum`.
 *
 * @param client The Client to use.
 * @param parameters `blockNumber` — the block number to fetch.
 * @returns The formatted block.
 * @throws {BlockNotFoundError} If the node returns an empty body (unknown block).
 */
export async function getBlock(
  client: Client,
  { blockNumber }: GetBlockParameters,
): Promise<GetBlockReturnType> {
  const response = await client.request<RawBlock>({
    node: 'full',
    path: 'getblockbynum',
    method: 'POST',
    body: { num: Number(blockNumber) },
  })
  if (isEmptyResponse(response)) throw new BlockNotFoundError({ blockNumber })
  return formatBlock(response)
}
