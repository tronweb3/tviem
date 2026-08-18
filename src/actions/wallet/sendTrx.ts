import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import {
  AccountNotFoundError,
  type AccountNotFoundErrorType,
} from '../../errors/rpc.js'
import type { ErrorType } from '../../errors/utils.js'
import {
  type ParseAccountErrorType,
  parseAccount,
} from '../../types/account.js'
import type { Address } from '../../types/address.js'
import type { Hex } from '../../types/misc.js'
import {
  type AddressToHexErrorType,
  addressToHex,
} from '../../utils/address/addressToHex.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../utils/transaction/registry.js'
import type { RawContract } from '../../utils/transaction/serializeRawData.js'
import {
  type BuildAndBroadcastErrorType,
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  type BuildTransactionErrorType,
  type BuildTransactionReturnType,
  buildTransaction,
  type MemoInput,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type SendTrxParameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Recipient Base58Check address. */
  to: Address
  /** Amount to send, in SUN. */
  amount: bigint
  /**
   * Optional memo written to `raw_data.data` (hex or raw bytes). Enters the
   * signed bytes; the chain charges a memo fee (`getMemoFee`, 1 TRX on
   * mainnet and Nile) on top of the transfer's normal costs.
   */
  memo?: MemoInput | undefined
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
  /**
   * Transaction lifetime in ms, applied to the chain-derived timestamp
   * (`expiration = refBlock.timestamp + expirationMs`). Positive integer,
   * at most 86_400_000 (24h). Ignored when a complete `blockHeader` is
   * supplied. @default 60_000
   */
  expirationMs?: bigint | number | undefined
}
export type SendTrxReturnType = BuildAndBroadcastReturnType

export type SendTrxErrorType =
  | AccountNotFoundErrorType
  | BuildAndBroadcastErrorType
  | ParseAccountErrorType
  | AddressToHexErrorType
  | ErrorType

export type BuildSendTrxParameters = SendTrxParameters & {
  /**
   * Multi-sig permission id (`Contract.Permission_id`) to bind the transaction
   * to an active/owner permission.
   */
  permissionId?: number | undefined
}
export type BuildSendTrxReturnType = BuildTransactionReturnType

export type BuildSendTrxErrorType =
  | AccountNotFoundErrorType
  | BuildTransactionErrorType
  | ParseAccountErrorType
  | AddressToHexErrorType
  | ErrorType

/** The signing account plus the assembled `TransferContract`. */
function assemble(
  client: Client,
  parameters: SendTrxParameters,
): { account: TronAccount; contract: RawContract } {
  const { to, amount } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  // Build the TransferContract (addresses enter the body as 41-hex).
  const contract: RawContract = {
    type: ContractType.TransferContract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}TransferContract`,
      value: {
        owner_address: addressToHex(account.address),
        to_address: addressToHex(to),
        amount,
      },
    },
  }

  return { account, contract }
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
 * @returns A TronWeb-shaped unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildSendTrx(
  client: Client,
  parameters: BuildSendTrxParameters,
): Promise<BuildSendTrxReturnType> {
  const { contract } = assemble(client, parameters)
  return buildTransaction(client, {
    contract,
    memo: parameters.memo,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
    expirationMs: parameters.expirationMs,
  })
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
 * @returns `{ txID, result, code, message }` — the locally computed
 * transaction id plus the node's acknowledgement fields, when echoed.
 */
export async function sendTrx(
  client: Client,
  parameters: SendTrxParameters,
): Promise<SendTrxReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    memo: parameters.memo,
    blockHeader: parameters.blockHeader,
    expirationMs: parameters.expirationMs,
  })
}
