import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import { AccountNotFoundError } from '../../errors/rpc.js'
import { parseAccount } from '../../types/account.js'
import type { Address } from '../../types/address.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import { toHex } from '../../utils/address/toHex.js'
import { bytesToHex } from '../../utils/encoding/toHex.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../utils/transaction/registry.js'
import type { RawContract } from '../../utils/transaction/serializeRawData.js'
import {
  type NodeTransaction,
  toNodeTransaction,
} from '../../utils/transaction/toNodeTransaction.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type SendTrxParameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Recipient Base58Check address. */
  to: Address
  /** Amount to send, in SUN. */
  amount: bigint
  /** Optional memo, written to `raw_data.data` (hex or raw bytes). */
  memo?: Hex | ByteArray | undefined
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type SendTrxReturnType = BuildAndBroadcastReturnType

export type BuildSendTrxParameters = SendTrxParameters & {
  /**
   * Multi-sig permission id (`Contract.Permission_id`) to bind the transaction
   * to an active/owner permission.
   */
  permissionId?: number | undefined
}
export type BuildSendTrxReturnType = NodeTransaction

/** The signing account plus the assembled `TransferContract` and memo `data`. */
function assemble(
  client: Client,
  parameters: SendTrxParameters,
): { account: TronAccount; contract: RawContract; data: string | undefined } {
  const { to, amount, memo } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  // Build the TransferContract (addresses enter the body as 41-hex).
  const contract: RawContract = {
    type: ContractType.TransferContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}TransferContract`,
      value: {
        ownerAddress: toHex(account.address),
        toAddress: toHex(to),
        amount,
      },
    },
  }

  return {
    account,
    contract,
    data: memo !== undefined ? memoToHex(memo) : undefined,
  }
}

/**
 * Builds an **unsigned** `TransferContract` transaction (§4.1) and returns it in
 * java-tron's HTTP JSON shape (TronWeb-compatible `{ visible, txID, raw_data,
 * raw_data_hex }`) — the build half of {@link sendTrx}, without signing or
 * broadcasting. Pass `permissionId` to bind it to an active/owner permission.
 * The node is used only to fetch the latest block (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Recipient, amount, optional memo/account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildSendTrx(
  client: Client,
  parameters: BuildSendTrxParameters,
): Promise<BuildSendTrxReturnType> {
  const { contract, data } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    data,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Sends TRX to a recipient by locally building, signing and broadcasting a
 * `TransferContract` transaction (§4.1). The transaction is assembled entirely
 * client-side; the node is used only to fetch the latest block (TaPoS) and to
 * broadcast. Timing is chain-derived from that block, never the wall clock; pass
 * `blockHeader` to build fully offline against a pinned block.
 *
 * @param client The Client to use.
 * @param parameters Recipient, amount, optional memo/account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function sendTrx(
  client: Client,
  parameters: SendTrxParameters,
): Promise<SendTrxReturnType> {
  const { account, contract, data } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    data,
    blockHeader: parameters.blockHeader,
  })
}

/** Normalizes a memo to bare (no `0x`), lowercase hex. */
function memoToHex(memo: Hex | ByteArray): string {
  if (typeof memo === 'string')
    return (memo.startsWith('0x') ? memo.slice(2) : memo).toLowerCase()
  return bytesToHex(memo).slice(2)
}
