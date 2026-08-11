import type { Client } from '../../clients/createClient.js'
import type { RequestErrorType } from '../../clients/transports/http.js'
import {
  IntegerOutOfRangeError,
  type IntegerOutOfRangeErrorType,
} from '../../errors/encoding.js'
import type { ErrorType } from '../../errors/utils.js'
import type { Address, AddressInput } from '../../types/address.js'
import {
  type ToBase58ErrorType,
  toBase58,
} from '../../utils/address/toBase58.js'
import { type ToHexErrorType, toHex } from '../../utils/address/toHex.js'
import type { ResourceCodeName } from '../../utils/transaction/types.js'
import { isEmptyResponse } from './getNowBlock.js'
import {
  formatPermission,
  type RawPermission,
  type SignWeightPermission,
} from './getSignWeight.js'

export type GetAccountParameters = {
  /** The Base58Check address to read. */
  address: Address
  /**
   * Read confirmed (solidified) state from the SolidityNode; pass `false` to
   * read the FullNode's latest (unconfirmed) state instead. @default true
   */
  confirmed?: boolean | undefined
}

/** An account permission (owner / active / witness) in formatted shape. */
export type AccountPermission = SignWeightPermission

/** One Stake 2.0 frozen tranche. */
export type AccountFrozenV2 = {
  /** Resource the stake backs (absent on the node = `'BANDWIDTH'`). */
  type: ResourceCodeName
  /** Staked amount in SUN (absent on the node = `0n`). */
  amount: bigint
}

/** One Stake 2.0 unstaking (pending withdrawal) entry. */
export type AccountUnfrozenV2 = {
  /** Resource the stake backed (absent on the node = `'BANDWIDTH'`). */
  type: ResourceCodeName
  /** Unstaked amount in SUN. */
  unfreezeAmount: bigint
  /** Timestamp (ms) the amount becomes withdrawable. */
  unfreezeExpireTime: bigint
}

/**
 * One legacy Stake 1.0 frozen entry (java-tron's `Frozen` message). Accounts
 * staked before the April 2023 Stake 2.0 migration and never unstaked still
 * carry these on mainnet; an expired `expireTime` means unfreezable, not
 * unstaked.
 */
export type AccountFrozenV1 = {
  /** Staked amount in SUN. */
  frozenBalance: bigint
  /** Timestamp (ms) the stake becomes unfreezable. */
  expireTime: bigint
}

/** An account's formatted on-chain state (the non-`null` `getAccount` result). */
export type AccountState = {
  /** The account's Base58Check address. */
  address: Address
  /** Account name as the node reports it (hex-encoded bytes), if set. */
  accountName?: string | undefined
  /** Account type (`'Normal'` unless the node says otherwise). */
  type: 'Normal' | 'AssetIssue' | 'Contract'
  /** TRX balance in SUN. */
  balance: bigint
  /** Creation timestamp (ms). */
  createTime: bigint
  /** Last operation timestamp (ms; node key `latest_opration_time`, sic). */
  latestOperationTime: bigint
  /** Unwithdrawn SR / voting rewards in SUN (`withdrawBalance` claims these). */
  allowance: bigint
  /** Last reward withdrawal timestamp (ms). */
  latestWithdrawTime: bigint
  /** Whether the account is a super representative. */
  isWitness: boolean
  /** Bandwidth consumed from staked allowance. */
  netUsage: bigint
  /** Bandwidth consumed from the free daily allowance. */
  freeNetUsage: bigint
  /** Last staked-bandwidth consumption timestamp (ms). */
  latestConsumeTime: bigint
  /** Last free-bandwidth consumption timestamp (ms). */
  latestConsumeFreeTime: bigint
  /** Bandwidth usage sliding-window size. */
  netWindowSize: bigint
  /** Energy consumed (from `account_resource`). */
  energyUsage: bigint
  /** Last energy consumption timestamp (ms). */
  latestConsumeTimeForEnergy: bigint
  /** Energy usage sliding-window size. */
  energyWindowSize: bigint
  /** Stake 2.0 frozen tranches (bandwidth / energy / TRON power). */
  frozenV2: AccountFrozenV2[]
  /** Stake 2.0 unstaking entries awaiting withdrawal. */
  unfrozenV2: AccountUnfrozenV2[]
  /** Bandwidth stake delegated to others, in SUN. */
  delegatedFrozenV2BalanceForBandwidth: bigint
  /** Bandwidth stake received from others, in SUN. */
  acquiredDelegatedFrozenV2BalanceForBandwidth: bigint
  /** Energy stake delegated to others, in SUN (from `account_resource`). */
  delegatedFrozenV2BalanceForEnergy: bigint
  /** Energy stake received from others, in SUN (from `account_resource`). */
  acquiredDelegatedFrozenV2BalanceForEnergy: bigint
  /** Legacy Stake 1.0 bandwidth stakes (node key `frozen`). */
  frozenV1: AccountFrozenV1[]
  /** Legacy Stake 1.0 energy stake (`account_resource.frozen_balance_for_energy`). */
  frozenForEnergyV1?: AccountFrozenV1 | undefined
  /** Legacy Stake 1.0 TRON-power stake (node key `tron_power`). */
  tronPowerV1?: AccountFrozenV1 | undefined
  /** Legacy TRON power after the Stake 2.0 migration (`old_tron_power`; may be `-1n`). */
  oldTronPower: bigint
  /** Legacy Stake 1.0 bandwidth stake delegated to others, in SUN. */
  delegatedFrozenBalanceForBandwidth: bigint
  /** Legacy Stake 1.0 bandwidth stake received from others, in SUN. */
  acquiredDelegatedFrozenBalanceForBandwidth: bigint
  /** Legacy Stake 1.0 energy stake delegated to others (from `account_resource`). */
  delegatedFrozenBalanceForEnergy: bigint
  /** Legacy Stake 1.0 energy stake received from others (from `account_resource`). */
  acquiredDelegatedFrozenBalanceForEnergy: bigint
  /** Votes cast for super representatives. */
  votes: { voteAddress: Address; voteCount: bigint }[]
  /** TRC10 balances (`assetV2`), keyed by token id. */
  assetV2: { key: string; value: bigint }[]
  /** TRC10 free-bandwidth usage (`free_asset_net_usageV2`), keyed by token id. */
  freeAssetNetUsageV2: { key: string; value: bigint }[]
  /** The owner permission, when the account exists on-chain. */
  ownerPermission?: AccountPermission | undefined
  /** Active permissions (empty for a default account response). */
  activePermission: AccountPermission[]
  /** The witness permission (super representatives only). */
  witnessPermission?: AccountPermission | undefined
}

export type GetAccountReturnType = AccountState | null

export type GetAccountErrorType =
  | IntegerOutOfRangeErrorType
  | RequestErrorType
  | ToBase58ErrorType
  | ToHexErrorType
  | ErrorType

type RawFrozenV1 = {
  frozen_balance?: number | string | undefined
  expire_time?: number | string | undefined
}
type RawFrozenV2 = {
  type?: string | undefined
  amount?: number | string | undefined
}
type RawUnfrozenV2 = {
  type?: string | undefined
  unfreeze_amount?: number | string | undefined
  unfreeze_expire_time?: number | string | undefined
}
type RawVote = {
  vote_address?: string | undefined
  vote_count?: number | string | undefined
}
type RawAccountResource = {
  energy_usage?: number | string | undefined
  latest_consume_time_for_energy?: number | string | undefined
  energy_window_size?: number | string | undefined
  delegated_frozenV2_balance_for_energy?: number | string | undefined
  acquired_delegated_frozenV2_balance_for_energy?: number | string | undefined
  frozen_balance_for_energy?: RawFrozenV1 | undefined
  delegated_frozen_balance_for_energy?: number | string | undefined
  acquired_delegated_frozen_balance_for_energy?: number | string | undefined
}
type RawAccount = {
  address?: string | undefined
  account_name?: string | undefined
  type?: string | number | undefined
  balance?: number | string | bigint | undefined
  create_time?: number | string | undefined
  /** java-tron's actual JSON key — the typo is part of the protocol. */
  latest_opration_time?: number | string | undefined
  allowance?: number | string | bigint | undefined
  latest_withdraw_time?: number | string | undefined
  is_witness?: boolean | undefined
  net_usage?: number | string | undefined
  free_net_usage?: number | string | undefined
  latest_consume_time?: number | string | undefined
  latest_consume_free_time?: number | string | undefined
  net_window_size?: number | string | undefined
  frozenV2?: RawFrozenV2[] | undefined
  unfrozenV2?: RawUnfrozenV2[] | undefined
  delegated_frozenV2_balance_for_bandwidth?: number | string | undefined
  acquired_delegated_frozenV2_balance_for_bandwidth?:
    | number
    | string
    | undefined
  frozen?: RawFrozenV1[] | undefined
  tron_power?: RawFrozenV1 | undefined
  old_tron_power?: number | string | undefined
  delegated_frozen_balance_for_bandwidth?: number | string | undefined
  acquired_delegated_frozen_balance_for_bandwidth?: number | string | undefined
  account_resource?: RawAccountResource | undefined
  votes?: RawVote[] | undefined
  assetV2?: { key?: string | undefined; value?: number | string | undefined }[]
  free_asset_net_usageV2?: {
    key?: string | undefined
    value?: number | string | undefined
  }[]
  owner_permission?: RawPermission | undefined
  active_permission?: RawPermission[] | undefined
  witness_permission?: RawPermission | undefined
}

/**
 * Coerces a possibly-absent int64 field to `bigint`, defaulting to `0n`. The
 * transport re-materializes unsafe integer literals as bigint where the engine
 * allows; where it cannot, an unsafe plain number has ALREADY lost precision
 * in `JSON.parse` — refuse to return it as if exact (the `getBalance` rule).
 */
function toSafeBigInt(value: number | string | bigint | undefined): bigint {
  const coerced = value ?? 0
  if (typeof coerced === 'number' && !Number.isSafeInteger(coerced))
    throw new IntegerOutOfRangeError({
      max: String(Number.MAX_SAFE_INTEGER),
      min: '0',
      value: String(coerced),
    })
  return BigInt(coerced)
}

function toAccountType(
  type: string | number | undefined,
): 'Normal' | 'AssetIssue' | 'Contract' {
  if (type === 'AssetIssue' || type === 1) return 'AssetIssue'
  if (type === 'Contract' || type === 2) return 'Contract'
  return 'Normal'
}

/** Absent resource enum on the wire is the proto3 default: `BANDWIDTH`. */
function toResourceCode(type: string | undefined): ResourceCodeName {
  return (type ?? 'BANDWIDTH') as ResourceCodeName
}

function toFrozenV1(frozen: RawFrozenV1): AccountFrozenV1 {
  return {
    frozenBalance: toSafeBigInt(frozen.frozen_balance),
    expireTime: toSafeBigInt(frozen.expire_time),
  }
}

/**
 * Reads an account's full on-chain state: balance, bandwidth/energy usage,
 * Stake 2.0 positions (frozen / unstaking / delegations), legacy Stake 1.0
 * positions still live on pre-migration accounts, votes, TRC10 balances and
 * permissions.
 *
 * Queries `getaccount` (same endpoint `getBalance` reads) — SolidityNode
 * (confirmed state) by default, FullNode with `confirmed: false`. A non-existent account returns an empty `{}` and maps
 * to `null`. TRON omits zero-valued fields, so every numeric field defaults
 * to `0n`; addresses come back Base58Check.
 *
 * @param client The Client to use.
 * @param parameters `address` — the Base58Check address to query.
 * @returns The formatted account, or `null` if the account does not exist.
 */
export async function getAccount(
  client: Client,
  { address, confirmed }: GetAccountParameters,
): Promise<GetAccountReturnType> {
  const response = await client.request<RawAccount>({
    node: (confirmed ?? true) ? 'solidity' : 'full',
    path: 'getaccount',
    method: 'POST',
    body: { address: toHex(address) },
  })
  if (isEmptyResponse(response)) return null

  const resource = response.account_resource ?? {}
  return {
    address: response.address
      ? toBase58(response.address as AddressInput)
      : address,
    ...(response.account_name !== undefined
      ? { accountName: response.account_name }
      : {}),
    type: toAccountType(response.type),
    balance: toSafeBigInt(response.balance),
    createTime: toSafeBigInt(response.create_time),
    latestOperationTime: toSafeBigInt(response.latest_opration_time),
    allowance: toSafeBigInt(response.allowance),
    latestWithdrawTime: toSafeBigInt(response.latest_withdraw_time),
    isWitness: response.is_witness ?? false,
    netUsage: toSafeBigInt(response.net_usage),
    freeNetUsage: toSafeBigInt(response.free_net_usage),
    latestConsumeTime: toSafeBigInt(response.latest_consume_time),
    latestConsumeFreeTime: toSafeBigInt(response.latest_consume_free_time),
    netWindowSize: toSafeBigInt(response.net_window_size),
    energyUsage: toSafeBigInt(resource.energy_usage),
    latestConsumeTimeForEnergy: toSafeBigInt(
      resource.latest_consume_time_for_energy,
    ),
    energyWindowSize: toSafeBigInt(resource.energy_window_size),
    frozenV2: (response.frozenV2 ?? []).map((frozen) => ({
      type: toResourceCode(frozen.type),
      amount: toSafeBigInt(frozen.amount),
    })),
    unfrozenV2: (response.unfrozenV2 ?? []).map((unfrozen) => ({
      type: toResourceCode(unfrozen.type),
      unfreezeAmount: toSafeBigInt(unfrozen.unfreeze_amount),
      unfreezeExpireTime: toSafeBigInt(unfrozen.unfreeze_expire_time),
    })),
    delegatedFrozenV2BalanceForBandwidth: toSafeBigInt(
      response.delegated_frozenV2_balance_for_bandwidth,
    ),
    acquiredDelegatedFrozenV2BalanceForBandwidth: toSafeBigInt(
      response.acquired_delegated_frozenV2_balance_for_bandwidth,
    ),
    delegatedFrozenV2BalanceForEnergy: toSafeBigInt(
      resource.delegated_frozenV2_balance_for_energy,
    ),
    acquiredDelegatedFrozenV2BalanceForEnergy: toSafeBigInt(
      resource.acquired_delegated_frozenV2_balance_for_energy,
    ),
    frozenV1: (response.frozen ?? []).map(toFrozenV1),
    ...(resource.frozen_balance_for_energy
      ? { frozenForEnergyV1: toFrozenV1(resource.frozen_balance_for_energy) }
      : {}),
    ...(response.tron_power
      ? { tronPowerV1: toFrozenV1(response.tron_power) }
      : {}),
    oldTronPower: toSafeBigInt(response.old_tron_power),
    delegatedFrozenBalanceForBandwidth: toSafeBigInt(
      response.delegated_frozen_balance_for_bandwidth,
    ),
    acquiredDelegatedFrozenBalanceForBandwidth: toSafeBigInt(
      response.acquired_delegated_frozen_balance_for_bandwidth,
    ),
    delegatedFrozenBalanceForEnergy: toSafeBigInt(
      resource.delegated_frozen_balance_for_energy,
    ),
    acquiredDelegatedFrozenBalanceForEnergy: toSafeBigInt(
      resource.acquired_delegated_frozen_balance_for_energy,
    ),
    votes: (response.votes ?? []).map((vote) => ({
      voteAddress: toBase58((vote.vote_address ?? '') as AddressInput),
      voteCount: toSafeBigInt(vote.vote_count),
    })),
    assetV2: (response.assetV2 ?? []).map((asset) => ({
      key: asset.key ?? '',
      value: toSafeBigInt(asset.value),
    })),
    freeAssetNetUsageV2: (response.free_asset_net_usageV2 ?? []).map(
      (usage) => ({
        key: usage.key ?? '',
        value: toSafeBigInt(usage.value),
      }),
    ),
    ...(response.owner_permission
      ? { ownerPermission: formatPermission(response.owner_permission) }
      : {}),
    activePermission: (response.active_permission ?? []).map(formatPermission),
    ...(response.witness_permission
      ? { witnessPermission: formatPermission(response.witness_permission) }
      : {}),
  }
}
