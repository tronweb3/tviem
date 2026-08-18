import type { Client } from '../../clients/createClient.js'
import type { RequestErrorType } from '../../clients/transports/http.js'
import {
  BlockNotFoundError,
  type BlockNotFoundErrorType,
} from '../../errors/rpc.js'
import type { ErrorType } from '../../errors/utils.js'
import type { TronHexAddress } from '../../types/address.js'
import type { Block } from '../../types/block.js'
import {
  type ToBase58ErrorType,
  toBase58,
} from '../../utils/address/toBase58.js'

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
    ...(header.witness_address
      ? { witnessAddress: toBase58(header.witness_address as TronHexAddress) }
      : {}),
    ...(header.version !== undefined ? { version: header.version } : {}),
    transactions: raw.transactions ?? [],
  }
}

export type GetNowBlockParameters = {
  /**
   * Read the latest solidified block from the SolidityNode instead of the
   * FullNode's chain head — the solidified block trails the head. Note that a
   * transaction's TaPoS reference block must be the head: `expiration` is
   * derived from the reference block's own timestamp, so a solidified one has
   * already spent most of the default lifetime before signing. @default false
   */
  confirmed?: boolean | undefined
}
export type GetNowBlockReturnType = Block

export type GetNowBlockErrorType =
  | BlockNotFoundErrorType
  | RequestErrorType
  | ToBase58ErrorType
  | ErrorType

/**
 * Fetches the latest block via `getnowblock` — the FullNode's (unconfirmed)
 * chain head by default, or the latest solidified block with
 * `confirmed: true`.
 *
 * The result satisfies `BlockRef`, so it can be passed straight to
 * `fillBlockHeader` when building a transaction's TaPoS reference fields.
 *
 * @param client The Client to use.
 * @param parameters Optional `confirmed` node selector.
 * @returns The latest block.
 */
export async function getNowBlock(
  client: Client,
  parameters?: GetNowBlockParameters,
): Promise<GetNowBlockReturnType> {
  const response = await client.request<RawBlock>({
    node: parameters?.confirmed ? 'solidity' : 'full',
    path: 'getnowblock',
    method: 'GET',
  })
  // An empty `{}` body (node warming up / LB stub) is "no block", not a block
  // whose every field defaulted.
  if (isEmptyResponse(response)) throw new BlockNotFoundError()
  return formatBlock(response)
}
