// TRON-specific, clean-room implementation for @tronweb3/omni.
import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import { AccountNotFoundError } from '../../errors/rpc.js'
import { parseAccount } from '../../types/account.js'
import type { Address } from '../../types/address.js'
import type { Hex } from '../../types/misc.js'
import { toHex } from '../../utils/address/toHex.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../utils/transaction/registry.js'
import type { RawContract } from '../../utils/transaction/serializeRawData.js'
import {
  type NodeTransaction,
  toNodeTransaction,
} from '../../utils/transaction/toNodeTransaction.js'
import type { FlexInput } from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type SendTrc10Parameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Recipient Base58Check address. */
  to: Address
  /**
   * TRC10 asset name/id (`asset_name`). Dual-form ("flex"): plain text/id
   * (e.g. `'1002000'`) is UTF-8 encoded; a `0x`-prefixed value is hex.
   */
  assetName: FlexInput
  /** Amount to send, in the asset's smallest unit. */
  amount: bigint
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type SendTrc10ReturnType = BuildAndBroadcastReturnType

export type BuildSendTrc10Parameters = SendTrc10Parameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildSendTrc10ReturnType = NodeTransaction

/** The signing account plus the assembled `TransferAssetContract`. */
function assemble(
  client: Client,
  parameters: SendTrc10Parameters,
): { account: TronAccount; contract: RawContract } {
  const { to, assetName, amount } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  // Build the TransferAssetContract (addresses enter the body as 41-hex;
  // asset_name is flex-normalized by the codec).
  const contract: RawContract = {
    type: ContractType.TransferAssetContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}TransferAssetContract`,
      value: {
        assetName,
        ownerAddress: toHex(account.address),
        toAddress: toHex(to),
        amount,
      },
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `TransferAssetContract` transaction (§ type 2) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link sendTrc10},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Recipient, asset name, amount, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildSendTrc10(
  client: Client,
  parameters: BuildSendTrc10Parameters,
): Promise<BuildSendTrc10ReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Sends a TRC10 asset to a recipient by locally building, signing and
 * broadcasting a `TransferAssetContract` (§ type 2). The `asset_name` field is
 * flex-normalized (UTF-8 text / id, or `0x`-hex). The transaction is assembled
 * entirely client-side; the node is used only to fetch the latest block (TaPoS)
 * and to broadcast. Timing is chain-derived from that block, never the wall
 * clock; pass `blockHeader` to build fully offline against a pinned block.
 *
 * @param client The Client to use.
 * @param parameters Recipient, asset name, amount, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function sendTrc10(
  client: Client,
  parameters: SendTrc10Parameters,
): Promise<SendTrc10ReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, { contract, account, blockHeader: parameters.blockHeader })
}
