// TRON-specific, clean-room implementation for @tronweb3/tviem (RD-2).
import type { Client } from '../../clients/createClient.js'
import { BlockNotFoundError } from '../../errors/rpc.js'
import type { TronHexAddress } from '../../types/address.js'
import type { Block } from '../../types/block.js'
import { toBase58 } from '../../utils/address/toBase58.js'

/** The raw block shape returned by `getnowblock` / `getblockbynum`. */
export type RawBlock = {
  blockID?: string | undefined
  block_header?:
    | {
        raw_data?:
          | {
              number?: number | undefined
              timestamp?: number | undefined
              parentHash?: string | undefined
              txTrieRoot?: string | undefined
              witness_address?: string | undefined
              version?: number | undefined
            }
          | undefined
      }
    | undefined
  transactions?: readonly unknown[] | undefined
}

/** Whether a node response body is an empty object (`{}`, "not found"). */
export function isEmptyResponse(response: unknown): boolean {
  return (
    !response ||
    typeof response !== 'object' ||
    Object.keys(response).length === 0
  )
}

/** Maps a raw node block into the formatted {@link Block} (satisfies `BlockRef`). */
export function formatBlock(raw: RawBlock): Block {
  const header = raw.block_header?.raw_data ?? {}
  return {
    blockID: raw.blockID ?? '',
    number: BigInt(header.number ?? 0),
    timestamp: BigInt(header.timestamp ?? 0),
    parentHash: header.parentHash ?? '',
    txTrieRoot: header.txTrieRoot ?? '',
    witnessAddress: toBase58(
      // The null address — '41' alone is not a valid address form.
      (header.witness_address ??
        '410000000000000000000000000000000000000000') as TronHexAddress,
    ),
    ...(header.version !== undefined ? { version: header.version } : {}),
    transactions: raw.transactions ?? [],
  }
}

export type GetNowBlockReturnType = Block

/**
 * Fetches the latest (unconfirmed) block from the FullNode via `getnowblock`.
 *
 * The result satisfies `BlockRef`, so it can be passed straight to
 * `fillBlockHeader` when building a transaction's TaPoS reference fields.
 *
 * @param client The Client to use.
 * @returns The latest block.
 */
export async function getNowBlock(
  client: Client,
): Promise<GetNowBlockReturnType> {
  const response = await client.request<RawBlock>({
    node: 'full',
    path: 'getnowblock',
    method: 'GET',
  })
  // An empty `{}` body (node warming up / LB stub) is "no block", not a block
  // whose every field defaulted.
  if (isEmptyResponse(response)) throw new BlockNotFoundError()
  return formatBlock(response)
}
