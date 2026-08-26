import { BaseError, type BaseErrorType } from '../../errors/base.js'
import type { ErrorType } from '../../errors/utils.js'
import type { AddressInput } from '../../types/address.js'
import type { ByteArray } from '../../types/misc.js'

/**
 * Any accepted address input form: Base58Check (`T…`), TRON hex (`41…`),
 * EVM hex (`0x…`), or the raw 21/20-byte payload. The canonical (decoded)
 * form is always the TRON hex form (`41…`, lowercase, no `0x` prefix) —
 * exactly what java-tron's `visible: false` JSON carries.
 */
export type ContractAddressInput = AddressInput | ByteArray

/**
 * Bytes field input: hex (`0x`-prefixed or bare) or raw bytes. The canonical
 * (decoded) form is always bare lowercase hex, matching java-tron's
 * `visible: false` JSON. Text-friendly inputs (e.g. a TRC10 asset name as
 * UTF-8) are an action-parameter convenience, encoded to hex before they
 * enter the model.
 */
export type BytesInput = string | ByteArray

/**
 * `int64` field input: `bigint`, `number`, or a decimal string. The
 * canonical (decoded) form is a JSON number within `±(2^53 − 1)` and a
 * decimal string beyond — see `int64ToJson`.
 */
export type Int64 = bigint | number | string

/** Resource type staked/delegated on TRON (wire values). */
export const ResourceCode = {
  BANDWIDTH: 0,
  ENERGY: 1,
} as const
export type ResourceCode = (typeof ResourceCode)[keyof typeof ResourceCode]

/** `ResourceType` enum names as java-tron's JSON renders them (index = wire value). */
export const ResourceCodeName = ['BANDWIDTH', 'ENERGY'] as const
export type ResourceCodeName = (typeof ResourceCodeName)[number]

export type ResourceCodeOfErrorType = BaseErrorType | ErrorType

/**
 * Resolves a staking resource name to its wire value, throwing on anything
 * else. Guards the untyped-JS path: indexing `ResourceCode` with a name the
 * enum does not carry ('TRON_POWER', a typo, wrong case) yields `undefined`,
 * which the protobuf writer drops — silently building a transaction for the
 * proto3-default resource (BANDWIDTH) instead of the one the caller named.
 */
export function resourceCodeOf(name: ResourceCodeName): ResourceCode {
  const code = ResourceCode[name]
  if (code === undefined)
    throw new BaseError(
      `Invalid staking resource "${name}". Expected one of: ${ResourceCodeName.join(', ')}.`,
    )
  return code
}

/** `Permission.PermissionType` (wire values). */
export const PermissionType = {
  OWNER: 0,
  WITNESS: 1,
  ACTIVE: 2,
} as const
export type PermissionType =
  (typeof PermissionType)[keyof typeof PermissionType]

/** `PermissionType` enum names as java-tron's JSON renders them. */
export const PermissionTypeName = ['Owner', 'Witness', 'Active'] as const
export type PermissionTypeName = (typeof PermissionTypeName)[number]

/** `AccountType` enum names as java-tron's JSON renders them. */
export const AccountTypeName = ['Normal', 'AssetIssue', 'Contract'] as const
export type AccountTypeName = (typeof AccountTypeName)[number]

/** `SmartContract.ABI.Entry.EntryType` (wire values). */
export const EntryType = {
  UNKNOWN_ENTRY_TYPE: 0,
  CONSTRUCTOR: 1,
  FUNCTION: 2,
  EVENT: 3,
  FALLBACK: 4,
  RECEIVE: 5,
  ERROR: 6,
} as const
export type EntryType = (typeof EntryType)[keyof typeof EntryType]

/** `EntryType` enum names as java-tron's JSON renders them. */
export const EntryTypeName = [
  'UnknownEntryType',
  'Constructor',
  'Function',
  'Event',
  'Fallback',
  'Receive',
  'Error',
] as const
export type EntryTypeName = (typeof EntryTypeName)[number]

/** `SmartContract.ABI.Entry.StateMutabilityType` (wire values). */
export const StateMutabilityType = {
  UNKNOWN_MUTABILITY_TYPE: 0,
  PURE: 1,
  VIEW: 2,
  NONPAYABLE: 3,
  PAYABLE: 4,
} as const
export type StateMutabilityType =
  (typeof StateMutabilityType)[keyof typeof StateMutabilityType]

/** `StateMutabilityType` enum names as java-tron's JSON renders them. */
export const StateMutabilityTypeName = [
  'UnknownMutabilityType',
  'Pure',
  'View',
  'Nonpayable',
  'Payable',
] as const
export type StateMutabilityTypeName = (typeof StateMutabilityTypeName)[number]

/** `TransferContract` (contract type 1) — TRX transfer. */
export type TransferContract = {
  /** Sender address (field 1). */
  owner_address: ContractAddressInput
  /** Recipient address (field 2). */
  to_address: ContractAddressInput
  /** Amount in SUN (field 3, `int64`). */
  amount: Int64
}

/** `TransferAssetContract` (contract type 2) — TRC10 transfer. */
export type TransferAssetContract = {
  /** TRC10 asset name/id (field 1, `bytes`, hex). */
  asset_name: BytesInput
  /** Sender address (field 2). */
  owner_address: ContractAddressInput
  /** Recipient address (field 3). */
  to_address: ContractAddressInput
  /** Amount in the asset's smallest unit (field 4, `int64`). */
  amount: Int64
}

/** A single vote inside `VoteWitnessContract` (`Vote` message). */
export type Vote = {
  /** Witness address voted for (field 1). */
  vote_address: ContractAddressInput
  /** Number of votes (field 2, `int64`). */
  vote_count: Int64
}

/** `VoteWitnessContract` (contract type 4). */
export type VoteWitnessContract = {
  /** Voter address (field 1). */
  owner_address: ContractAddressInput
  /** Votes (field 2, repeated). */
  votes?: Vote[] | undefined
  /** Support flag (field 3, `bool`). */
  support?: boolean | undefined
}

/** `WithdrawBalanceContract` (contract type 13) — withdraw block rewards. */
export type WithdrawBalanceContract = {
  /** Account address (field 1). */
  owner_address: ContractAddressInput
}

/** `UpdateBrokerageContract` (type 49). */
export type UpdateBrokerageContract = {
  /** Witness account address (field 1). */
  owner_address: ContractAddressInput
  /** New brokerage percentage, 0..100 (field 2, `int32`). */
  brokerage: number
}

/** `SmartContract.ABI.Entry.Param`. */
export type SmartContractAbiParam = {
  /** Whether the parameter is indexed (field 1, `bool`). */
  indexed?: boolean | undefined
  /** Parameter name (field 2, `string`). */
  name?: string | undefined
  /** Parameter type (field 3, `string`). */
  type?: string | undefined
}

/** `SmartContract.ABI.Entry`. */
export type SmartContractAbiEntry = {
  /** Whether the event is anonymous (field 1, `bool`). */
  anonymous?: boolean | undefined
  /** Whether the entry is constant (field 2, `bool`). */
  constant?: boolean | undefined
  /** Entry name (field 3, `string`). */
  name?: string | undefined
  /** Input parameters (field 4, repeated). */
  inputs?: SmartContractAbiParam[] | undefined
  /** Output parameters (field 5, repeated). */
  outputs?: SmartContractAbiParam[] | undefined
  /** Entry type (field 6, enum — see `EntryTypeName`). */
  type?: EntryTypeName | number | undefined
  /** Whether the entry is payable (field 7, `bool`). */
  payable?: boolean | undefined
  /**
   * State mutability (field 8, enum — see `StateMutabilityTypeName`).
   * NOTE: java-tron keeps this proto field camelCase (it mirrors the
   * Solidity JSON ABI), so the JSON key is `stateMutability` verbatim.
   */
  stateMutability?: StateMutabilityTypeName | number | undefined
}

/** `SmartContract.ABI`. `entrys` is java-tron's own spelling. */
export type SmartContractAbi = {
  /** ABI entries (field 1, repeated). */
  entrys?: SmartContractAbiEntry[] | undefined
}

/** `SmartContract` (nested in `CreateSmartContract`). */
export type SmartContract = {
  /** Contract creator address (field 1). */
  origin_address?: ContractAddressInput | undefined
  /** Contract address (field 2). */
  contract_address?: ContractAddressInput | undefined
  /** Contract ABI (field 3). */
  abi?: SmartContractAbi | undefined
  /** Deployment bytecode (field 4, `bytes`). */
  bytecode?: BytesInput | undefined
  /**
   * TRX sent with the deployment, in SUN (field 5, `int64`). Note the
   * deployment call value lives here, not on `CreateSmartContract`.
   */
  call_value?: Int64 | undefined
  /** Percentage of energy consumed by the caller (field 6, `int64`). */
  consume_user_resource_percent?: Int64 | undefined
  /** Contract name (field 7, `string`). */
  name?: string | undefined
  /** Creator energy limit (field 8, `int64`). */
  origin_energy_limit?: Int64 | undefined
  /** Code hash (field 9, `bytes`). */
  code_hash?: BytesInput | undefined
  /** Transaction hash (field 10, `bytes`). */
  trx_hash?: BytesInput | undefined
  /** Contract version (field 11, `int32`). */
  version?: number | undefined
}

/** `CreateSmartContract` (contract type 30). */
export type CreateSmartContract = {
  /** Deployer address (field 1). */
  owner_address: ContractAddressInput
  /** Contract to deploy (field 2). */
  new_contract?: SmartContract | undefined
  /** TRC10 amount sent with the deployment (field 3, `int64`). */
  call_token_value?: Int64 | undefined
  /** TRC10 token id (field 4, `int64`). */
  token_id?: Int64 | undefined
}

/** `TriggerSmartContract` (contract type 31). */
export type TriggerSmartContract = {
  /** Caller address (field 1). */
  owner_address: ContractAddressInput
  /** Contract address (field 2). */
  contract_address: ContractAddressInput
  /** TRX sent with the call, in SUN (field 3, `int64`). */
  call_value?: Int64 | undefined
  /** Call data (field 4, `bytes`). */
  data?: BytesInput | undefined
  /** TRC10 amount sent with the call (field 5, `int64`). */
  call_token_value?: Int64 | undefined
  /** TRC10 token id (field 6, `int64`). */
  token_id?: Int64 | undefined
}

/** `Permission.Key` — a signer address and its weight. */
export type PermissionKey = {
  /** Signer address (field 1). */
  address: ContractAddressInput
  /** Signature weight (field 2, `int64`). */
  weight: Int64
}

/** `Permission` (nested in `AccountPermissionUpdateContract`). */
export type Permission = {
  /** Permission type (field 1, enum — see `PermissionTypeName`). */
  type?: PermissionTypeName | number | undefined
  /** Permission id (field 2, `int32`). */
  id?: number | undefined
  /** Permission name (field 3, `string`). */
  permission_name?: string | undefined
  /** Signature weight threshold (field 4, `int64`). */
  threshold?: Int64 | undefined
  /** Parent permission id (field 5, `int32`). */
  parent_id?: number | undefined
  /** Allowed contract types, as a 32-byte bitmap (field 6, `bytes`). */
  operations?: BytesInput | undefined
  /** Signer keys (field 7, repeated). */
  keys?: PermissionKey[] | undefined
}

/** `AccountPermissionUpdateContract` (contract type 46). */
export type AccountPermissionUpdateContract = {
  /** Account address (field 1). */
  owner_address: ContractAddressInput
  /** Owner permission (field 2). */
  owner?: Permission | undefined
  /** Witness permission (field 3). */
  witness?: Permission | undefined
  /** Active permissions (field 4, repeated). */
  actives?: Permission[] | undefined
}

/** `FreezeBalanceContract` (contract type 11) — Stake 1.0 freeze. */
export type FreezeBalanceContract = {
  /** Account address (field 1). */
  owner_address: ContractAddressInput
  /** Amount to freeze, in SUN (field 2, `int64`). */
  frozen_balance: Int64
  /** Freeze duration, in days (field 3, `int64`). */
  frozen_duration: Int64
  /** Resource type (field 10, enum — see `ResourceCodeName`). */
  resource?: ResourceCodeName | number | undefined
  /** Recipient address the resource is obtained for (field 15). */
  receiver_address?: ContractAddressInput | undefined
}

/** `UnfreezeBalanceContract` (contract type 12) — Stake 1.0 unfreeze. */
export type UnfreezeBalanceContract = {
  /** Account address (field 1). */
  owner_address: ContractAddressInput
  /** Resource type (field 10, enum — see `ResourceCodeName`). */
  resource?: ResourceCodeName | number | undefined
  /** Recipient address the resource was obtained for (field 15). */
  receiver_address?: ContractAddressInput | undefined
}

/** `ParticipateAssetIssueContract` (contract type 9) — buy a TRC10 token. */
export type ParticipateAssetIssueContract = {
  /** Buyer address (field 1). */
  owner_address: ContractAddressInput
  /** Token issuer address (field 2). */
  to_address: ContractAddressInput
  /** TRC10 asset name/id (field 3, `bytes`, hex). */
  asset_name: BytesInput
  /** Amount of TRX paid, in SUN (field 4, `int64`). */
  amount: Int64
}

/** `AssetIssueContract.FrozenSupply` — a staked-supply tranche. */
export type AssetIssueFrozenSupply = {
  /** Amount of the token supply frozen (field 1, `int64`). */
  frozen_amount: Int64
  /** Freeze duration, in days (field 2, `int64`). */
  frozen_days: Int64
}

/** `AssetIssueContract` (contract type 6) — create a TRC10 token. */
export type AssetIssueContract = {
  /** Issuer address (field 1). */
  owner_address: ContractAddressInput
  /** Token name (field 2, `bytes`, hex). */
  name: BytesInput
  /** Token abbreviation (field 3, `bytes`, hex). */
  abbr: BytesInput
  /** Total supply (field 4, `int64`). */
  total_supply: Int64
  /** Staked-supply tranches (field 5, repeated). */
  frozen_supply?: AssetIssueFrozenSupply[] | undefined
  /** TRX numerator of the ICO price ratio `trx_num/num` (field 6, `int32`). */
  trx_num: number
  /** Number of token decimals (field 7, `int32`). */
  precision?: number | undefined
  /** Token numerator of the ICO price ratio `trx_num/num` (field 8, `int32`). */
  num: number
  /** ICO start time, ms (field 9, `int64`). */
  start_time: Int64
  /** ICO end time, ms (field 10, `int64`). */
  end_time: Int64
  /** Unused by java-tron; kept for wire compatibility (field 11, `int64`). */
  order?: Int64 | undefined
  /** Vote score (field 16, `int32`). */
  vote_score?: number | undefined
  /** Token description (field 20, `bytes`, hex). */
  description: BytesInput
  /** Token website URL (field 21, `bytes`, hex). */
  url: BytesInput
  /** Free bandwidth cap per holder, per rolling 24h (field 22, `int64`). */
  free_asset_net_limit?: Int64 | undefined
  /**
   * Total free bandwidth shared by all holders, per rolling 24h (field 23,
   * `int64`).
   */
  public_free_asset_net_limit?: Int64 | undefined
  /** Shared free bandwidth already consumed (field 24, `int64`). */
  public_free_asset_net_usage?: Int64 | undefined
  /** Last shared free-bandwidth consumption time, ms (field 25, `int64`). */
  public_latest_free_net_time?: Int64 | undefined
  /** Chain-assigned TRC10 token id (field 41, `string`). */
  id?: string | undefined
}

/** `UpdateAssetContract` (contract type 15) — update a TRC10 token. */
export type UpdateAssetContract = {
  /** Issuer address (field 1). */
  owner_address: ContractAddressInput
  /** New token description (field 2, `bytes`, hex). */
  description: BytesInput
  /** New token website URL (field 3, `bytes`, hex). */
  url: BytesInput
  /** New per-holder free bandwidth cap, per rolling 24h (field 4, `int64`). */
  new_limit: Int64
  /**
   * New total free bandwidth shared by all holders, per rolling 24h (field 5,
   * `int64`).
   */
  new_public_limit: Int64
}

/** `FreezeBalanceV2Contract` (contract type 54) — stake 2.0 freeze. */
export type FreezeBalanceV2Contract = {
  /** Account address (field 1). */
  owner_address: ContractAddressInput
  /** Amount to freeze, in SUN (field 2, `int64`). */
  frozen_balance: Int64
  /** Resource type (field 3, enum — see `ResourceCodeName`). */
  resource?: ResourceCodeName | number | undefined
}

/** `UnfreezeBalanceV2Contract` (contract type 55) — stake 2.0 unfreeze. */
export type UnfreezeBalanceV2Contract = {
  /** Account address (field 1). */
  owner_address: ContractAddressInput
  /** Amount to unfreeze, in SUN (field 2, `int64`). */
  unfreeze_balance: Int64
  /** Resource type (field 3, enum — see `ResourceCodeName`). */
  resource?: ResourceCodeName | number | undefined
}

/** `WithdrawExpireUnfreezeContract` (contract type 56). */
export type WithdrawExpireUnfreezeContract = {
  /** Account address (field 1). */
  owner_address: ContractAddressInput
}

/** `DelegateResourceContract` (contract type 57). */
export type DelegateResourceContract = {
  /** Delegator address (field 1). */
  owner_address: ContractAddressInput
  /** Resource type (field 2, enum — see `ResourceCodeName`). */
  resource?: ResourceCodeName | number | undefined
  /** Amount to delegate, in SUN (field 3, `int64`). */
  balance: Int64
  /** Recipient address (field 4). */
  receiver_address: ContractAddressInput
  /** Whether the delegation is locked (field 5, `bool`). */
  lock?: boolean | undefined
  /** Lock period, in blocks (field 6, `int64`). */
  lock_period?: Int64 | undefined
}

/** `UnDelegateResourceContract` (contract type 58). */
export type UnDelegateResourceContract = {
  /** Delegator address (field 1). */
  owner_address: ContractAddressInput
  /** Resource type (field 2, enum — see `ResourceCodeName`). */
  resource?: ResourceCodeName | number | undefined
  /** Amount to undelegate, in SUN (field 3, `int64`). */
  balance: Int64
  /** Recipient address (field 4). */
  receiver_address: ContractAddressInput
}

/** `CancelAllUnfreezeV2Contract` (contract type 59). */
export type CancelAllUnfreezeV2Contract = {
  /** Account address (field 1). */
  owner_address: ContractAddressInput
}

/** `AccountCreateContract` (contract type 0) — create a new account. */
export type AccountCreateContract = {
  /** Creator (payer) address (field 1). */
  owner_address: ContractAddressInput
  /** Address of the account to create (field 2). */
  account_address: ContractAddressInput
  /** Account type (field 3, enum — see `AccountTypeName`). */
  type?: AccountTypeName | number | undefined
}

/** `AccountUpdateContract` (contract type 10) — set an account name. */
export type AccountUpdateContract = {
  /** Account name (field 1, `bytes`, hex). */
  account_name: BytesInput
  /** Account address (field 2). */
  owner_address: ContractAddressInput
}

/** `SetAccountIdContract` (contract type 19) — set an account id. */
export type SetAccountIdContract = {
  /** Account id (field 1, `bytes`, hex). */
  account_id: BytesInput
  /** Account address (field 2). */
  owner_address: ContractAddressInput
}

/** `WitnessCreateContract` (contract type 5) — apply to become an SR. */
export type WitnessCreateContract = {
  /** Applicant account address (field 1). */
  owner_address: ContractAddressInput
  /** Witness page URL (field 2, `bytes`, hex). */
  url: BytesInput
}

/** `WitnessUpdateContract` (contract type 8) — update an SR's URL. */
export type WitnessUpdateContract = {
  /** Witness account address (field 1). */
  owner_address: ContractAddressInput
  /** New witness page URL (field 12, `bytes`, hex). */
  update_url: BytesInput
}

/** `ClearABIContract` (contract type 48) — clear a contract's ABI. */
export type ClearABIContract = {
  /** Owner (deployer) address (field 1). */
  owner_address: ContractAddressInput
  /** Contract address (field 2). */
  contract_address: ContractAddressInput
}

/** `UpdateSettingContract` (contract type 33) — update the user resource share. */
export type UpdateSettingContract = {
  /** Owner (deployer) address (field 1). */
  owner_address: ContractAddressInput
  /** Contract address (field 2). */
  contract_address: ContractAddressInput
  /** Percentage of energy consumed by the caller (field 3, `int64`). */
  consume_user_resource_percent: Int64
}

/** `UpdateEnergyLimitContract` (contract type 45) — update a contract's energy limit. */
export type UpdateEnergyLimitContract = {
  /** Owner (deployer) address (field 1). */
  owner_address: ContractAddressInput
  /** Contract address (field 2). */
  contract_address: ContractAddressInput
  /** Creator energy limit (field 3, `int64`). */
  origin_energy_limit: Int64
}

/** A single `map<int64,int64>` entry inside `ProposalCreateContract`. */
export type ProposalParameter = {
  /** Chain-parameter id (map key, `int64`). */
  key: Int64
  /** New parameter value (map value, `int64`). */
  value: Int64
}

/** `ProposalCreateContract` (contract type 16) — create a governance proposal. */
export type ProposalCreateContract = {
  /** Proposer address (field 1). */
  owner_address: ContractAddressInput
  /** Proposed chain-parameter changes (field 2, `map<int64,int64>`). */
  parameters?: ProposalParameter[] | undefined
}

/** `ProposalApproveContract` (contract type 17) — approve/disapprove a proposal. */
export type ProposalApproveContract = {
  /** Voter address (field 1). */
  owner_address: ContractAddressInput
  /** Proposal id (field 2, `int64`). */
  proposal_id: Int64
  /** Whether to add (true) or remove (false) approval (field 3, `bool`). */
  is_add_approval?: boolean | undefined
}

/** `ProposalDeleteContract` (contract type 18) — delete a proposal. */
export type ProposalDeleteContract = {
  /** Proposer address (field 1). */
  owner_address: ContractAddressInput
  /** Proposal id (field 2, `int64`). */
  proposal_id: Int64
}

/** `ExchangeCreateContract` (contract type 41) — create a Bancor exchange pair. */
export type ExchangeCreateContract = {
  /** Creator address (field 1). */
  owner_address: ContractAddressInput
  /** First token id (field 2, `bytes`, hex). */
  first_token_id: BytesInput
  /** First token balance seeded into the exchange (field 3, `int64`). */
  first_token_balance: Int64
  /** Second token id (field 4, `bytes`, hex). */
  second_token_id: BytesInput
  /** Second token balance seeded into the exchange (field 5, `int64`). */
  second_token_balance: Int64
}

/** `ExchangeInjectContract` (contract type 42) — inject liquidity into an exchange. */
export type ExchangeInjectContract = {
  /** Owner address (field 1). */
  owner_address: ContractAddressInput
  /** Exchange id (field 2, `int64`). */
  exchange_id: Int64
  /** Token id to inject (field 3, `bytes`, hex). */
  token_id: BytesInput
  /** Amount of the token to inject (field 4, `int64`). */
  quant: Int64
}

/** `ExchangeWithdrawContract` (contract type 43) — withdraw liquidity from an exchange. */
export type ExchangeWithdrawContract = {
  /** Owner address (field 1). */
  owner_address: ContractAddressInput
  /** Exchange id (field 2, `int64`). */
  exchange_id: Int64
  /** Token id to withdraw (field 3, `bytes`, hex). */
  token_id: BytesInput
  /** Amount of the token to withdraw (field 4, `int64`). */
  quant: Int64
}

/** `ExchangeTransactionContract` (contract type 44) — trade against an exchange. */
export type ExchangeTransactionContract = {
  /** Trader address (field 1). */
  owner_address: ContractAddressInput
  /** Exchange id (field 2, `int64`). */
  exchange_id: Int64
  /** Token id sold into the exchange (field 3, `bytes`, hex). */
  token_id: BytesInput
  /** Amount of the token sold (field 4, `int64`). */
  quant: Int64
  /** Minimum amount of the counter-token expected (field 5, `int64`). */
  expected: Int64
}

/** Union of all registered (known) contract message models. */
export type ContractMessage =
  | TransferContract
  | TransferAssetContract
  | VoteWitnessContract
  | FreezeBalanceContract
  | UnfreezeBalanceContract
  | ParticipateAssetIssueContract
  | AssetIssueContract
  | UpdateAssetContract
  | WithdrawBalanceContract
  | CreateSmartContract
  | TriggerSmartContract
  | AccountPermissionUpdateContract
  | FreezeBalanceV2Contract
  | UnfreezeBalanceV2Contract
  | WithdrawExpireUnfreezeContract
  | DelegateResourceContract
  | UnDelegateResourceContract
  | CancelAllUnfreezeV2Contract
  | UpdateBrokerageContract
  | AccountCreateContract
  | AccountUpdateContract
  | SetAccountIdContract
  | WitnessCreateContract
  | WitnessUpdateContract
  | ClearABIContract
  | UpdateSettingContract
  | UpdateEnergyLimitContract
  | ProposalCreateContract
  | ProposalApproveContract
  | ProposalDeleteContract
  | ExchangeCreateContract
  | ExchangeInjectContract
  | ExchangeWithdrawContract
  | ExchangeTransactionContract
