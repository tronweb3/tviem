// TRON-specific, clean-room implementation for @tronweb3/tviem.
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
import type { ExchangeWithdrawContract } from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
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
}
export type ExchangeWithdrawReturnType = BuildAndBroadcastReturnType

export type BuildExchangeWithdrawParameters = ExchangeWithdrawParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildExchangeWithdrawReturnType = NodeTransaction

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
    ownerAddress: toHex(account.address),
    exchangeId: BigInt(exchangeId),
    tokenId,
    quant,
  }

  const contract: RawContract = {
    type: ContractType.ExchangeWithdrawContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}ExchangeWithdrawContract`,
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
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildExchangeWithdraw(
  client: Client,
  parameters: BuildExchangeWithdrawParameters,
): Promise<BuildExchangeWithdrawReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
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
  })
}
