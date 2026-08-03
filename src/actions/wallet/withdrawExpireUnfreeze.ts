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
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type WithdrawExpireUnfreezeParameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type WithdrawExpireUnfreezeReturnType = BuildAndBroadcastReturnType

export type BuildWithdrawExpireUnfreezeParameters =
  WithdrawExpireUnfreezeParameters & {
    /** Multi-sig permission id (`Contract.Permission_id`). */
    permissionId?: number | undefined
  }
export type BuildWithdrawExpireUnfreezeReturnType = NodeTransaction

/** The signing account plus the assembled `WithdrawExpireUnfreezeContract`. */
function assemble(
  client: Client,
  parameters: WithdrawExpireUnfreezeParameters,
): { account: TronAccount; contract: RawContract } {
  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  // Build the WithdrawExpireUnfreezeContract (carries only the owner address).
  const contract: RawContract = {
    type: ContractType.WithdrawExpireUnfreezeContract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}WithdrawExpireUnfreezeContract`,
      value: {
        owner_address: toHex(account.address),
      },
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `WithdrawExpireUnfreezeContract` transaction (§ type
 * 56) and returns it in java-tron's HTTP JSON shape (TronWeb-compatible
 * `{ visible, txID, raw_data, raw_data_hex }`) — the build half of
 * {@link withdrawExpireUnfreeze}, without signing or broadcasting. Pass
 * `permissionId` to bind it to an active/owner permission. The node is used only
 * to fetch the latest block (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildWithdrawExpireUnfreeze(
  client: Client,
  parameters: BuildWithdrawExpireUnfreezeParameters = {},
): Promise<BuildWithdrawExpireUnfreezeReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Withdraws all Stake 2.0 unfrozen balances whose 14-day window has elapsed,
 * releasing them back to the spendable balance, by locally building, signing
 * and broadcasting a `WithdrawExpireUnfreezeContract` (§ type 56). Carries only
 * the owner address.
 *
 * @param client The Client to use.
 * @param parameters Optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function withdrawExpireUnfreeze(
  client: Client,
  parameters: WithdrawExpireUnfreezeParameters = {},
): Promise<WithdrawExpireUnfreezeReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
