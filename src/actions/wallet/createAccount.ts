// TRON-specific, clean-room implementation for @tronweb3/tviem.
import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import { AccountNotFoundError } from '../../errors/rpc.js'
import { parseAccount } from '../../types/account.js'
import type { Address } from '../../types/address.js'
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
import type { AccountCreateContract } from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type CreateAccountParameters = {
  /** The signing (creator/payer) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Address of the account to create. */
  accountAddress: Address
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type CreateAccountReturnType = BuildAndBroadcastReturnType

export type BuildCreateAccountParameters = CreateAccountParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildCreateAccountReturnType = NodeTransaction

/** The signing account plus the assembled `AccountCreateContract`. */
function assemble(
  client: Client,
  parameters: CreateAccountParameters,
): { account: TronAccount; contract: RawContract } {
  const { accountAddress } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: AccountCreateContract = {
    ownerAddress: toHex(account.address),
    accountAddress: toHex(accountAddress),
  }

  const contract: RawContract = {
    type: ContractType.AccountCreateContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}AccountCreateContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `AccountCreateContract` transaction (§ type 0) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link createAccount},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters New account address, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildCreateAccount(
  client: Client,
  parameters: BuildCreateAccountParameters,
): Promise<BuildCreateAccountReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Creates a new (unactivated) account on-chain by locally building, signing and
 * broadcasting an `AccountCreateContract` (§ type 0).
 *
 * @param client The Client to use.
 * @param parameters New account address, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function createAccount(
  client: Client,
  parameters: CreateAccountParameters,
): Promise<CreateAccountReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
