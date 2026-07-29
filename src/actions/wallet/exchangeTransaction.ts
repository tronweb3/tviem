import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import { AccountNotFoundError } from '../../errors/rpc.js'
import { parseAccount } from '../../types/account.js'
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
import type { ExchangeTransactionContract } from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type ExchangeTransactionParameters = {
  /** The signing (trader) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Id of the exchange to trade against. */
  exchangeId: bigint | number
  /** Token id being sold into the exchange (TRC10 id text, or `'_'` for TRX). */
  tokenId: string
  /** Amount of the token sold. */
  quant: bigint
  /** Minimum amount of the counter-token expected in return. */
  expected: bigint
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type ExchangeTransactionReturnType = BuildAndBroadcastReturnType

export type BuildExchangeTransactionParameters =
  ExchangeTransactionParameters & {
    /** Multi-sig permission id (`Contract.Permission_id`). */
    permissionId?: number | undefined
  }
export type BuildExchangeTransactionReturnType = NodeTransaction

/** The signing account plus the assembled `ExchangeTransactionContract`. */
function assemble(
  client: Client,
  parameters: ExchangeTransactionParameters,
): { account: TronAccount; contract: RawContract } {
  const { exchangeId, tokenId, quant, expected } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: ExchangeTransactionContract = {
    ownerAddress: toHex(account.address),
    exchangeId: BigInt(exchangeId),
    tokenId,
    quant,
    expected,
  }

  const contract: RawContract = {
    type: ContractType.ExchangeTransactionContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}ExchangeTransactionContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `ExchangeTransactionContract` transaction (§ type 44)
 * and returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of
 * {@link exchangeTransaction}, without signing or broadcasting. Pass
 * `permissionId` to bind it to an active/owner permission. The node is used
 * only to fetch the latest block (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Exchange id + token/quant/expected, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildExchangeTransaction(
  client: Client,
  parameters: BuildExchangeTransactionParameters,
): Promise<BuildExchangeTransactionReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Trades against a Bancor exchange by locally building, signing and
 * broadcasting an `ExchangeTransactionContract` (§ type 44).
 *
 * @param client The Client to use.
 * @param parameters Exchange id + token/quant/expected, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function exchangeTransaction(
  client: Client,
  parameters: ExchangeTransactionParameters,
): Promise<ExchangeTransactionReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
