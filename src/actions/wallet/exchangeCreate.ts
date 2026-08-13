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
import { type ToHexErrorType, toHex } from '../../utils/address/toHex.js'
import {
  type FlexErrorType,
  flexToHex,
} from '../../utils/transaction/normalize.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../utils/transaction/registry.js'
import type { RawContract } from '../../utils/transaction/serializeRawData.js'
import type { ExchangeCreateContract } from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastErrorType,
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  type BuildTransactionErrorType,
  type BuildTransactionReturnType,
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type ExchangeCreateParameters = {
  /** The signing (creator) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** First token id (TRC10 id text like `'1000001'`, or `'_'` for TRX). */
  firstTokenId: string
  /** First token balance seeded into the exchange. */
  firstTokenBalance: bigint
  /** Second token id (TRC10 id text, or `'_'` for TRX). */
  secondTokenId: string
  /** Second token balance seeded into the exchange. */
  secondTokenBalance: bigint
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
export type ExchangeCreateReturnType = BuildAndBroadcastReturnType

export type ExchangeCreateErrorType =
  | AccountNotFoundErrorType
  | BuildAndBroadcastErrorType
  | FlexErrorType
  | ParseAccountErrorType
  | ToHexErrorType
  | ErrorType

export type BuildExchangeCreateParameters = ExchangeCreateParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildExchangeCreateReturnType = BuildTransactionReturnType

export type BuildExchangeCreateErrorType =
  | AccountNotFoundErrorType
  | BuildTransactionErrorType
  | FlexErrorType
  | ParseAccountErrorType
  | ToHexErrorType
  | ErrorType

/** The signing account plus the assembled `ExchangeCreateContract`. */
function assemble(
  client: Client,
  parameters: ExchangeCreateParameters,
): { account: TronAccount; contract: RawContract } {
  const { firstTokenId, firstTokenBalance, secondTokenId, secondTokenBalance } =
    parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: ExchangeCreateContract = {
    owner_address: toHex(account.address),
    first_token_id: flexToHex(firstTokenId),
    first_token_balance: firstTokenBalance,
    second_token_id: flexToHex(secondTokenId),
    second_token_balance: secondTokenBalance,
  }

  const contract: RawContract = {
    type: ContractType.ExchangeCreateContract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}ExchangeCreateContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `ExchangeCreateContract` transaction (§ type 41) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link exchangeCreate},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Token ids + balances, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildExchangeCreate(
  client: Client,
  parameters: BuildExchangeCreateParameters,
): Promise<BuildExchangeCreateReturnType> {
  const { contract } = assemble(client, parameters)
  return buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
    expirationMs: parameters.expirationMs,
  })
}

/**
 * Creates a Bancor exchange (trading pair) by locally building, signing and
 * broadcasting an `ExchangeCreateContract` (§ type 41).
 *
 * @param client The Client to use.
 * @param parameters Token ids + balances, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function exchangeCreate(
  client: Client,
  parameters: ExchangeCreateParameters,
): Promise<ExchangeCreateReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
    expirationMs: parameters.expirationMs,
  })
}
