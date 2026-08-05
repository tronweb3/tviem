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
import { type ToHexErrorType, toHex } from '../../utils/address/toHex.js'
import {
  type FlexErrorType,
  type FlexInput,
  flexToHex,
} from '../../utils/transaction/normalize.js'
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
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type PurchaseTokenParameters = {
  /** The signing (buyer) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** The token issuer's Base58Check address. */
  issuerAddress: Address
  /**
   * TRC10 token id (`asset_name`). Dual-form ("flex"): plain text/id (e.g.
   * `'1002000'`) is UTF-8 encoded; a `0x`-prefixed value is hex.
   */
  tokenId: FlexInput
  /** Amount of TRX to pay, in SUN. */
  amount: bigint
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type PurchaseTokenReturnType = BuildAndBroadcastReturnType

export type PurchaseTokenErrorType =
  | AccountNotFoundErrorType
  | BuildAndBroadcastErrorType
  | FlexErrorType
  | ParseAccountErrorType
  | ToHexErrorType
  | ErrorType

export type BuildPurchaseTokenParameters = PurchaseTokenParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildPurchaseTokenReturnType = BuildTransactionReturnType

export type BuildPurchaseTokenErrorType =
  | AccountNotFoundErrorType
  | BuildTransactionErrorType
  | FlexErrorType
  | ParseAccountErrorType
  | ToHexErrorType
  | ErrorType

/** The signing account plus the assembled `ParticipateAssetIssueContract`. */
function assemble(
  client: Client,
  parameters: PurchaseTokenParameters,
): { account: TronAccount; contract: RawContract } {
  const { issuerAddress, tokenId, amount } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const contract: RawContract = {
    type: ContractType.ParticipateAssetIssueContract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}ParticipateAssetIssueContract`,
      value: {
        owner_address: toHex(account.address),
        to_address: toHex(issuerAddress),
        asset_name: flexToHex(tokenId),
        amount,
      },
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `ParticipateAssetIssueContract` transaction (§ type 9)
 * and returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link purchaseToken},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Issuer, token id, amount, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildPurchaseToken(
  client: Client,
  parameters: BuildPurchaseTokenParameters,
): Promise<BuildPurchaseTokenReturnType> {
  const { contract } = assemble(client, parameters)
  return buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
}

/**
 * Buys (participates in) a TRC10 token issuance by locally building, signing
 * and broadcasting a `ParticipateAssetIssueContract` (§ type 9).
 *
 * @param client The Client to use.
 * @param parameters Issuer, token id, amount, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function purchaseToken(
  client: Client,
  parameters: PurchaseTokenParameters,
): Promise<PurchaseTokenReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
