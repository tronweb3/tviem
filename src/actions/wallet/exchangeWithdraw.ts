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
import type { Hex } from '../../types/misc.js'
import {
  type AddressToHexErrorType,
  addressToHex,
} from '../../utils/address/addressToHex.js'
import {
  type FlexErrorType,
  flexToHex,
} from '../../utils/transaction/normalize.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../utils/transaction/registry.js'
import type { RawContract } from '../../utils/transaction/serializeRawData.js'
import type { ExchangeWithdrawContract } from '../../utils/transaction/types.js'
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

export type ExchangeWithdrawParameters = {
  /** The signing (owner) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Id of the exchange to withdraw liquidity from. */
  exchangeId: bigint | number
  /** Token id being withdrawn (TRC10 id text, or `'_'` for TRX). */
  tokenId: string
  /** Amount of the token to withdraw. */
  quant: bigint
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
  /**
   * Optional memo written to `raw_data.data` (hex or raw bytes). Enters the
   * signed bytes; the chain charges a memo fee (`getMemoFee`, 1 TRX on
   * mainnet and Nile) on top of the transaction's normal costs.
   */
  memo?: MemoInput | undefined
}
export type ExchangeWithdrawReturnType = BuildAndBroadcastReturnType

export type ExchangeWithdrawErrorType =
  | AccountNotFoundErrorType
  | BuildAndBroadcastErrorType
  | FlexErrorType
  | ParseAccountErrorType
  | AddressToHexErrorType
  | ErrorType

export type BuildExchangeWithdrawParameters = ExchangeWithdrawParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildExchangeWithdrawReturnType = BuildTransactionReturnType

export type BuildExchangeWithdrawErrorType =
  | AccountNotFoundErrorType
  | BuildTransactionErrorType
  | FlexErrorType
  | ParseAccountErrorType
  | AddressToHexErrorType
  | ErrorType

/** The signing account plus the assembled `ExchangeWithdrawContract`. */
function assemble(
  client: Client,
  parameters: ExchangeWithdrawParameters,
): { account: TronAccount; contract: RawContract } {
  const { exchangeId, tokenId, quant } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: ExchangeWithdrawContract = {
    owner_address: addressToHex(account.address),
    exchange_id: BigInt(exchangeId),
    token_id: flexToHex(tokenId),
    quant,
  }

  const contract: RawContract = {
    type: ContractType.ExchangeWithdrawContract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}ExchangeWithdrawContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `ExchangeWithdrawContract` transaction (§ type 43) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link exchangeWithdraw},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Exchange id + token/quant, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildExchangeWithdraw(
  client: Client,
  parameters: BuildExchangeWithdrawParameters,
): Promise<BuildExchangeWithdrawReturnType> {
  const { contract } = assemble(client, parameters)
  return buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
    expirationMs: parameters.expirationMs,
    memo: parameters.memo,
  })
}

/**
 * Withdraws liquidity from a Bancor exchange by locally building, signing and
 * broadcasting an `ExchangeWithdrawContract` (§ type 43).
 *
 * @param client The Client to use.
 * @param parameters Exchange id + token/quant, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function exchangeWithdraw(
  client: Client,
  parameters: ExchangeWithdrawParameters,
): Promise<ExchangeWithdrawReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
    expirationMs: parameters.expirationMs,
    memo: parameters.memo,
  })
}
