import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import {
  maxAccountIdLength,
  minAccountIdLength,
} from '../../constants/transaction.js'
import { BaseError, type BaseErrorType } from '../../errors/base.js'
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
  type FlexInput,
  flexToHex,
} from '../../utils/transaction/normalize.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../utils/transaction/registry.js'
import type { RawContract } from '../../utils/transaction/serializeRawData.js'
import type { SetAccountIdContract } from '../../utils/transaction/types.js'
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

export type SetAccountIdParameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /**
   * Account id to set (`account_id`). Dual-form ("flex"): plain text/id
   * (e.g. `'omniaaa'`) is UTF-8 encoded; a `0x`-prefixed value is hex.
   */
  accountId: FlexInput
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
export type SetAccountIdReturnType = BuildAndBroadcastReturnType

export type SetAccountIdErrorType =
  | AccountNotFoundErrorType
  | BaseErrorType
  | BuildAndBroadcastErrorType
  | FlexErrorType
  | ParseAccountErrorType
  | AddressToHexErrorType
  | ErrorType

export type BuildSetAccountIdParameters = SetAccountIdParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildSetAccountIdReturnType = BuildTransactionReturnType

export type BuildSetAccountIdErrorType =
  | AccountNotFoundErrorType
  | BaseErrorType
  | BuildTransactionErrorType
  | FlexErrorType
  | ParseAccountErrorType
  | AddressToHexErrorType
  | ErrorType

/** The signing account plus the assembled `SetAccountIdContract`. */
function assemble(
  client: Client,
  parameters: SetAccountIdParameters,
): { account: TronAccount; contract: RawContract } {
  const { accountId } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  // Bound the id before it can be signed. java-tron checks the length in
  // `SetAccountIdActuator.validate()`, and the id is write-once — a rejected
  // attempt costs bandwidth, and there is no second chance to correct one that
  // slips through. The bound is on the encoded BYTES: a flex id arrives as
  // either text or hex, so the input string's own length says nothing.
  const account_id = flexToHex(accountId)
  const byteLength = account_id.length / 2
  if (byteLength < minAccountIdLength || byteLength > maxAccountIdLength)
    throw new BaseError(
      `Invalid account id: ${byteLength} bytes. Expected ${minAccountIdLength} to ${maxAccountIdLength} bytes — java-tron rejects anything outside that range.`,
    )

  const value: SetAccountIdContract = {
    account_id,
    owner_address: addressToHex(account.address),
  }

  const contract: RawContract = {
    type: ContractType.SetAccountIdContract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}SetAccountIdContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `SetAccountIdContract` transaction (§ type 19) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link setAccountId},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Account id, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildSetAccountId(
  client: Client,
  parameters: BuildSetAccountIdParameters,
): Promise<BuildSetAccountIdReturnType> {
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
 * Sets a unique on-chain account id by locally building, signing and
 * broadcasting a `SetAccountIdContract` (§ type 19).
 *
 * @param client The Client to use.
 * @param parameters Account id, optional account/blockHeader.
 * @returns `{ txID, result, code, message }` — the locally computed
 * transaction id plus the node's acknowledgement fields, when echoed.
 */
export async function setAccountId(
  client: Client,
  parameters: SetAccountIdParameters,
): Promise<SetAccountIdReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
    expirationMs: parameters.expirationMs,
    memo: parameters.memo,
  })
}
