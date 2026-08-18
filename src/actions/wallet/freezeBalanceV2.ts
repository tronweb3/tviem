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
  ContractType,
  contractTypeUrlPrefix,
} from '../../utils/transaction/registry.js'
import type { RawContract } from '../../utils/transaction/serializeRawData.js'
import {
  type ResourceCodeOfErrorType,
  resourceCodeOf,
} from '../../utils/transaction/types.js'
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

/** Resource type stakeable under Stake 2.0. */
export type StakeResource = 'BANDWIDTH' | 'ENERGY'

export type FreezeBalanceV2Parameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Amount to freeze, in SUN. */
  frozenBalance: bigint
  /** Resource obtained by freezing. */
  resource: StakeResource
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
export type FreezeBalanceV2ReturnType = BuildAndBroadcastReturnType

export type FreezeBalanceV2ErrorType =
  | AccountNotFoundErrorType
  | BuildAndBroadcastErrorType
  | ParseAccountErrorType
  | ResourceCodeOfErrorType
  | AddressToHexErrorType
  | ErrorType

export type BuildFreezeBalanceV2Parameters = FreezeBalanceV2Parameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildFreezeBalanceV2ReturnType = BuildTransactionReturnType

export type BuildFreezeBalanceV2ErrorType =
  | AccountNotFoundErrorType
  | BuildTransactionErrorType
  | ParseAccountErrorType
  | ResourceCodeOfErrorType
  | AddressToHexErrorType
  | ErrorType

/** The signing account plus the assembled `FreezeBalanceV2Contract`. */
function assemble(
  client: Client,
  parameters: FreezeBalanceV2Parameters,
): { account: TronAccount; contract: RawContract } {
  const { frozenBalance, resource } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  // Build the FreezeBalanceV2Contract (addresses enter the body as 41-hex).
  const contract: RawContract = {
    type: ContractType.FreezeBalanceV2Contract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}FreezeBalanceV2Contract`,
      value: {
        owner_address: addressToHex(account.address),
        frozen_balance: frozenBalance,
        resource: resourceCodeOf(resource),
      },
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `FreezeBalanceV2Contract` transaction (§ type 54) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link freezeBalanceV2},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Amount, resource, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildFreezeBalanceV2(
  client: Client,
  parameters: BuildFreezeBalanceV2Parameters,
): Promise<BuildFreezeBalanceV2ReturnType> {
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
 * Stakes (freezes) TRX for bandwidth or energy under Stake 2.0 by locally
 * building, signing and broadcasting a `FreezeBalanceV2Contract` (§ type 54).
 *
 * @param client The Client to use.
 * @param parameters Amount, resource, optional account/blockHeader.
 * @returns `{ txID, result, code, message }` — the locally computed
 * transaction id plus the node's acknowledgement fields, when echoed.
 */
export async function freezeBalanceV2(
  client: Client,
  parameters: FreezeBalanceV2Parameters,
): Promise<FreezeBalanceV2ReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
    expirationMs: parameters.expirationMs,
    memo: parameters.memo,
  })
}
