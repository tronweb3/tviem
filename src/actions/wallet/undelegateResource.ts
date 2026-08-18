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
  type ResourceCodeOfErrorType,
  resourceCodeOf,
  type UnDelegateResourceContract,
} from '../../utils/transaction/types.js'
import type { DelegateResource } from './delegateResource.js'
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

export type UndelegateResourceParameters = {
  /** The signing (delegator) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Account the resource was delegated to. */
  receiverAddress: Address
  /** Amount to undelegate, in SUN. */
  balance: bigint
  /** Resource undelegated. */
  resource: DelegateResource
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
export type UndelegateResourceReturnType = BuildAndBroadcastReturnType

export type UndelegateResourceErrorType =
  | AccountNotFoundErrorType
  | BuildAndBroadcastErrorType
  | ParseAccountErrorType
  | ResourceCodeOfErrorType
  | AddressToHexErrorType
  | ErrorType

export type BuildUndelegateResourceParameters = UndelegateResourceParameters & {
  /**
   * Multi-sig permission id (`Contract.Permission_id`) to bind the transaction
   * to an active/owner permission.
   */
  permissionId?: number | undefined
}
export type BuildUndelegateResourceReturnType = BuildTransactionReturnType

export type BuildUndelegateResourceErrorType =
  | AccountNotFoundErrorType
  | BuildTransactionErrorType
  | ParseAccountErrorType
  | ResourceCodeOfErrorType
  | AddressToHexErrorType
  | ErrorType

/** The signing account plus the assembled `UnDelegateResourceContract`. */
function assemble(
  client: Client,
  parameters: UndelegateResourceParameters,
): { account: TronAccount; contract: RawContract } {
  const { receiverAddress, balance, resource } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: UnDelegateResourceContract = {
    owner_address: addressToHex(account.address),
    resource: resourceCodeOf(resource),
    balance,
    receiver_address: addressToHex(receiverAddress),
  }

  const contract: RawContract = {
    type: ContractType.UnDelegateResourceContract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}UnDelegateResourceContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `UnDelegateResourceContract` transaction (§ type 58)
 * and returns it in java-tron's HTTP JSON shape (TronWeb-compatible
 * `{ visible, txID, raw_data, raw_data_hex }`) — the build half of
 * {@link undelegateResource}, without signing or broadcasting. Pass
 * `permissionId` to bind it to an active/owner permission. The node is used
 * only to fetch the latest block (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Receiver, amount, resource, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildUndelegateResource(
  client: Client,
  parameters: BuildUndelegateResourceParameters,
): Promise<BuildUndelegateResourceReturnType> {
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
 * Reclaims resource previously delegated to another account under Stake 2.0 by
 * locally building, signing and broadcasting an `UnDelegateResourceContract`
 * (§ type 58).
 *
 * @param client The Client to use.
 * @param parameters Receiver, amount, resource, optional account/blockHeader.
 * @returns `{ txID, result, code, message }` — the locally computed
 * transaction id plus the node's acknowledgement fields, when echoed.
 */
export async function undelegateResource(
  client: Client,
  parameters: UndelegateResourceParameters,
): Promise<UndelegateResourceReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
    expirationMs: parameters.expirationMs,
    memo: parameters.memo,
  })
}
