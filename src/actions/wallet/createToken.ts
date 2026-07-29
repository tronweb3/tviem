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
import type {
  AssetIssueContract,
  FlexInput,
} from '../../utils/transaction/types.js'
import {
  type BuildAndBroadcastReturnType,
  buildAndBroadcast,
} from './utils/buildAndBroadcast.js'
import {
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

/** A single staked-supply tranche of a token issuance. */
export type CreateTokenFrozenSupply = {
  /** Amount of the token supply to freeze. */
  frozenAmount: bigint
  /** Freeze duration, in days. */
  frozenDays: bigint
}

export type CreateTokenParameters = {
  /** The signing (issuer) account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Token name (dual string/hex form). */
  name: FlexInput
  /** Token abbreviation (dual string/hex form). */
  abbr: FlexInput
  /** Total supply. */
  totalSupply: bigint
  /** TRX numerator of the ICO price ratio `trxNum/num`. */
  trxNum: number
  /** Token numerator of the ICO price ratio `trxNum/num`. */
  num: number
  /** Number of token decimals (0..6). */
  precision?: number | undefined
  /** ICO start time, ms since epoch. */
  startTime: bigint
  /** ICO end time, ms since epoch. */
  endTime: bigint
  /** Token description (dual string/hex form). */
  description: FlexInput
  /** Token website URL (dual string/hex form). */
  url: FlexInput
  /** Creator-donated bandwidth for token holders. */
  freeAssetNetLimit?: bigint | undefined
  /** Per-holder free bandwidth cap. */
  publicFreeAssetNetLimit?: bigint | undefined
  /** Staked-supply tranches. */
  frozenSupply?: CreateTokenFrozenSupply[] | undefined
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type CreateTokenReturnType = BuildAndBroadcastReturnType

export type BuildCreateTokenParameters = CreateTokenParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildCreateTokenReturnType = NodeTransaction

/** The signing account plus the assembled `AssetIssueContract`. */
function assemble(
  client: Client,
  parameters: CreateTokenParameters,
): { account: TronAccount; contract: RawContract } {
  const {
    name,
    abbr,
    totalSupply,
    trxNum,
    num,
    precision,
    startTime,
    endTime,
    description,
    url,
    freeAssetNetLimit,
    publicFreeAssetNetLimit,
    frozenSupply,
  } = parameters

  // Resolve the owner/signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  const value: AssetIssueContract = {
    ownerAddress: toHex(account.address),
    name,
    abbr,
    totalSupply,
    trxNum,
    num,
    startTime,
    endTime,
    description,
    url,
  }
  if (precision !== undefined) value.precision = precision
  if (freeAssetNetLimit !== undefined)
    value.freeAssetNetLimit = freeAssetNetLimit
  if (publicFreeAssetNetLimit !== undefined)
    value.publicFreeAssetNetLimit = publicFreeAssetNetLimit
  if (frozenSupply !== undefined && frozenSupply.length > 0)
    value.frozenSupply = frozenSupply.map((entry) => ({
      frozenAmount: entry.frozenAmount,
      frozenDays: entry.frozenDays,
    }))

  const contract: RawContract = {
    type: ContractType.AssetIssueContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}AssetIssueContract`,
      value,
    },
  }

  return { account, contract }
}

/**
 * Builds an **unsigned** `AssetIssueContract` transaction (§ type 6) and
 * returns it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible,
 * txID, raw_data, raw_data_hex }`) — the build half of {@link createToken},
 * without signing or broadcasting. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Token issuance parameters, optional account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned {@link NodeTransaction}.
 */
export async function buildCreateToken(
  client: Client,
  parameters: BuildCreateTokenParameters,
): Promise<BuildCreateTokenReturnType> {
  const { contract } = assemble(client, parameters)
  const unsigned = await buildTransaction(client, {
    contract,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
  })
  return toNodeTransaction(unsigned)
}

/**
 * Issues (creates) a TRC10 token by locally building, signing and broadcasting
 * an `AssetIssueContract` (§ type 6).
 *
 * @param client The Client to use.
 * @param parameters Token issuance parameters, optional account/blockHeader.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function createToken(
  client: Client,
  parameters: CreateTokenParameters,
): Promise<CreateTokenReturnType> {
  const { account, contract } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    blockHeader: parameters.blockHeader,
  })
}
