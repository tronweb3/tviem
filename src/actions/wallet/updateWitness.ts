import type { AccountKey, TronAccount } from '../../accounts/types.js'
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
import type { WitnessUpdateContract } from '../../utils/transaction/types.js'
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

export type UpdateWitnessParameters = {
  /** The signing (witness) account (falls back to `client.account`). */
  account?: TronAccount | AccountKey | undefined
  /**
   * New witness page URL (`update_url`). Dual-form ("flex"): plain text is
   * UTF-8 encoded; a `0x`-prefixed value is hex.
   */
  url: FlexInput
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
export type UpdateWitnessReturnType = BuildAndBroadcastReturnType

export type UpdateWitnessErrorType =
  | AccountNotFoundErrorType
  | BuildAndBroadcastErrorType
  | FlexErrorType
  | ParseAccountErrorType
  | AddressToHexErrorType
  | ErrorType

export type BuildUpdateWitnessParameters = UpdateWitnessParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildUpdateWitnessReturnType = BuildTransactionReturnType

export type BuildUpdateWitnessErrorType =
  | AccountNotFoundErrorType
  | BuildTransactionErrorType
  | FlexErrorType
  | ParseAccountErrorType
  | AddressToHexErrorType
  | ErrorType

/** The signing account plus the assembled `WitnessUpdateContract`. */
function assemble(
  client: Client,
  parameters: UpdateWitnessParameters,
): { account: TronAccount; contract: RawContract } {
  const { url } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: WitnessUpdateContract = {
    owner_address: addressToHex(account.address),
    update_url: flexToHex(url),
  }

  const contract: RawContract = {
    type: ContractType.WitnessUpdateContract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}WitnessUpdateContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `WitnessUpdateContract` transaction (§ type 8) and
 * returns it in java-tron's HTTP JSON shape (`{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link updateWitness},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Witness URL, optional account/permissionId/blockHeader.
 * @returns An unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildUpdateWitness(
  client: Client,
  parameters: BuildUpdateWitnessParameters,
): Promise<BuildUpdateWitnessReturnType> {
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
 * Updates a super representative's page URL by locally building, signing and
 * broadcasting a `WitnessUpdateContract` (§ type 8).
 *
 * @param client The Client to use.
 * @param parameters Witness URL, optional account/blockHeader.
 * @returns `{ txID, result, code, message }` — the locally computed
 * transaction id plus the node's acknowledgement fields, when echoed.
 */
export async function updateWitness(
  client: Client,
  parameters: UpdateWitnessParameters,
): Promise<UpdateWitnessReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
    expirationMs: parameters.expirationMs,
    memo: parameters.memo,
  })
}
