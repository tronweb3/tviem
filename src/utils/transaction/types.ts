import type { AddressInput } from '../../types/address.js'
import type { ByteArray, Hex } from '../../types/misc.js'

/**
 * Any accepted address input form: Base58Check (`T…`), TRON hex (`41…`),
 * EVM hex (`0x…`), or the raw 21/20-byte payload. Decoders always produce
 * the TRON hex form (`41…`, lowercase, no `0x` prefix).
 */
export type ContractAddressInput = AddressInput | ByteArray

/**
 * Bytes field input: `0x`-prefixed hex or raw bytes. Decoders always
 * produce `0x`-prefixed hex.
 */
export type BytesInput = Hex | ByteArray

/**
 * Dual-form ("flex") field input, e.g. a TRC10 `asset_name`: UTF-8 text,
 * hex, or raw bytes — see `flex`. Decoders always produce `0x`-prefixed hex.
 */
export type FlexInput = string | Hex | ByteArray

/** A decoded wire field that is not part of the message schema. */
export type UnknownField =
  | { fieldNo: number; wireType: 0; value: bigint }
  | { fieldNo: number; wireType: 1 | 2 | 5; value: Hex }

/**
 * Decode-side mixin: wire fields outside the schema are preserved here
 * instead of throwing. Encoders ignore it.
 */
export type WithUnknownFields = {
  __unknown?: UnknownField[] | undefined
}

/** Decode result for an unregistered `google.protobuf.Any` type URL. */
export type UnknownContractParameter = {
  __unknown: true
  typeUrl: string
  valueBytes: ByteArray
}

/** Resource type staked/delegated on TRON. */
export const ResourceCode = {
  BANDWIDTH: 0,
  ENERGY: 1,
  TRON_POWER: 2,
} as const
export type ResourceCode = (typeof ResourceCode)[keyof typeof ResourceCode]

/** `Permission.PermissionType`. */
export const PermissionType = {
  OWNER: 0,
  WITNESS: 1,
  ACTIVE: 2,
} as const
export type PermissionType =
  (typeof PermissionType)[keyof typeof PermissionType]

/** `SmartContract.ABI.Entry.EntryType`. */
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

/** `SmartContract.ABI.Entry.StateMutabilityType`. */
export const StateMutabilityType = {
  UNKNOWN_MUTABILITY_TYPE: 0,
  PURE: 1,
  VIEW: 2,
  NONPAYABLE: 3,
  PAYABLE: 4,
} as const
export type StateMutabilityType =
  (typeof StateMutabilityType)[keyof typeof StateMutabilityType]

/** `TransferContract` (contract type 1) — TRX transfer. */
export type TransferContract = WithUnknownFields & {
  /** Sender address (field 1). */
  ownerAddress: ContractAddressInput
  /** Recipient address (field 2). */
  toAddress: ContractAddressInput
  /** Amount in SUN (field 3, `int64`). */
  amount: bigint
}

/** `TransferAssetContract` (contract type 2) — TRC10 transfer. */
export type TransferAssetContract = WithUnknownFields & {
  /** TRC10 asset name/id (field 1, dual string/hex form). */
  assetName: FlexInput
  /** Sender address (field 2). */
  ownerAddress: ContractAddressInput
  /** Recipient address (field 3). */
  toAddress: ContractAddressInput
  /** Amount in the asset's smallest unit (field 4, `int64`). */
  amount: bigint
}

/** A single vote inside `VoteWitnessContract` (`Vote` message). */
export type Vote = WithUnknownFields & {
  /** Witness address voted for (field 1). */
  voteAddress: ContractAddressInput
  /** Number of votes (field 2, `int64`). */
  voteCount: bigint
}

/** `VoteWitnessContract` (contract type 4). */
export type VoteWitnessContract = WithUnknownFields & {
  /** Voter address (field 1). */
  ownerAddress: ContractAddressInput
  /** Votes (field 2, repeated). */
  votes?: Vote[] | undefined
  /** Support flag (field 3, `bool`). */
  support?: boolean | undefined
}

/** `WithdrawBalanceContract` (contract type 13) — withdraw block rewards. */
export type WithdrawBalanceContract = WithUnknownFields & {
  /** Account address (field 1). */
  ownerAddress: ContractAddressInput
}

/** `UpdateBrokerageContract` (type 49). */
export type UpdateBrokerageContract = WithUnknownFields & {
  /** Witness account address (field 1). */
  ownerAddress: ContractAddressInput
  /** New brokerage percentage, 0..100 (field 2, `int32`). */
  brokerage: number
}

/** `SmartContract.ABI.Entry.Param`. */
export type SmartContractAbiParam = WithUnknownFields & {
  /** Whether the parameter is indexed (field 1, `bool`). */
  indexed?: boolean | undefined
  /** Parameter name (field 2, `string`). */
  name?: string | undefined
  /** Parameter type (field 3, `string`). */
  type?: string | undefined
}

/** `SmartContract.ABI.Entry`. */
export type SmartContractAbiEntry = WithUnknownFields & {
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
  /** Entry type (field 6, enum — see `EntryType`). */
  type?: number | undefined
  /** Whether the entry is payable (field 7, `bool`). */
  payable?: boolean | undefined
  /** State mutability (field 8, enum — see `StateMutabilityType`). */
  stateMutability?: number | undefined
}

/** `SmartContract.ABI`. */
export type SmartContractAbi = WithUnknownFields & {
  /** ABI entries (field 1, repeated). */
  entrys?: SmartContractAbiEntry[] | undefined
}

/** `SmartContract` (nested in `CreateSmartContract`). */
export type SmartContract = WithUnknownFields & {
  /** Contract creator address (field 1). */
  originAddress?: ContractAddressInput | undefined
  /** Contract address (field 2). */
  contractAddress?: ContractAddressInput | undefined
  /** Contract ABI (field 3). */
  abi?: SmartContractAbi | undefined
  /** Deployment bytecode (field 4, `bytes`). */
  bytecode?: BytesInput | undefined
  /**
   * TRX sent with the deployment, in SUN (field 5, `int64`). Note the
   * deployment call value lives here, not on `CreateSmartContract`.
   */
  callValue?: bigint | undefined
  /** Percentage of energy consumed by the caller (field 6, `int64`). */
  consumeUserResourcePercent?: bigint | undefined
  /** Contract name (field 7, `string`). */
  name?: string | undefined
  /** Creator energy limit (field 8, `int64`). */
  originEnergyLimit?: bigint | undefined
  /** Code hash (field 9, `bytes`). */
  codeHash?: BytesInput | undefined
  /** Transaction hash (field 10, `bytes`). */
  trxHash?: BytesInput | undefined
  /** Contract version (field 11, `int32`). */
  version?: number | undefined
}

/** `CreateSmartContract` (contract type 30). */
export type CreateSmartContract = WithUnknownFields & {
  /** Deployer address (field 1). */
  ownerAddress: ContractAddressInput
  /** Contract to deploy (field 2). */
  newContract?: SmartContract | undefined
  /** TRC10 amount sent with the deployment (field 3, `int64`). */
  callTokenValue?: bigint | undefined
  /** TRC10 token id (field 4, `int64`). */
  tokenId?: bigint | undefined
}

/** `TriggerSmartContract` (contract type 31). */
export type TriggerSmartContract = WithUnknownFields & {
  /** Caller address (field 1). */
  ownerAddress: ContractAddressInput
  /** Contract address (field 2). */
  contractAddress: ContractAddressInput
  /** TRX sent with the call, in SUN (field 3, `int64`). */
  callValue?: bigint | undefined
  /** Call data (field 4, `bytes`). */
  data?: BytesInput | undefined
  /** TRC10 amount sent with the call (field 5, `int64`). */
  callTokenValue?: bigint | undefined
  /** TRC10 token id (field 6, `int64`). */
  tokenId?: bigint | undefined
}

/** `Permission.Key` — a signer address and its weight. */
export type PermissionKey = WithUnknownFields & {
  /** Signer address (field 1). */
  address: ContractAddressInput
  /** Signature weight (field 2, `int64`). */
  weight: bigint
}

/** `Permission` (nested in `AccountPermissionUpdateContract`). */
export type Permission = WithUnknownFields & {
  /** Permission type (field 1, enum — see `PermissionType`). */
  type?: number | undefined
  /** Permission id (field 2, `int32`). */
  id?: number | undefined
  /** Permission name (field 3, `string`). */
  permissionName?: string | undefined
  /** Signature weight threshold (field 4, `int64`). */
  threshold?: bigint | undefined
  /** Parent permission id (field 5, `int32`). */
  parentId?: number | undefined
  /** Allowed contract types, as a 32-byte bitmap (field 6, `bytes`). */
  operations?: BytesInput | undefined
  /** Signer keys (field 7, repeated). */
  keys?: PermissionKey[] | undefined
}

/** `AccountPermissionUpdateContract` (contract type 46). */
export type AccountPermissionUpdateContract = WithUnknownFields & {
  /** Account address (field 1). */
  ownerAddress: ContractAddressInput
  /** Owner permission (field 2). */
  owner?: Permission | undefined
  /** Witness permission (field 3). */
  witness?: Permission | undefined
  /** Active permissions (field 4, repeated). */
  actives?: Permission[] | undefined
}

/** `FreezeBalanceContract` (contract type 11) — Stake 1.0 freeze. */
export type FreezeBalanceContract = WithUnknownFields & {
  /** Account address (field 1). */
  ownerAddress: ContractAddressInput
  /** Amount to freeze, in SUN (field 2, `int64`). */
  frozenBalance: bigint
  /** Freeze duration, in days (field 3, `int64`). */
  frozenDuration: bigint
  /** Resource type (field 10, enum — see `ResourceCode`). */
  resource?: number | undefined
  /** Recipient address the resource is obtained for (field 15). */
  receiverAddress?: ContractAddressInput | undefined
}

/** `UnfreezeBalanceContract` (contract type 12) — Stake 1.0 unfreeze. */
export type UnfreezeBalanceContract = WithUnknownFields & {
  /** Account address (field 1). */
  ownerAddress: ContractAddressInput
  /** Resource type (field 10, enum — see `ResourceCode`). */
  resource?: number | undefined
  /** Recipient address the resource was obtained for (field 15). */
  receiverAddress?: ContractAddressInput | undefined
}

/** `ParticipateAssetIssueContract` (contract type 9) — buy a TRC10 token. */
export type ParticipateAssetIssueContract = WithUnknownFields & {
  /** Buyer address (field 1). */
  ownerAddress: ContractAddressInput
  /** Token issuer address (field 2). */
  toAddress: ContractAddressInput
  /** TRC10 asset name/id (field 3, dual string/hex form). */
  assetName: FlexInput
  /** Amount of TRX paid, in SUN (field 4, `int64`). */
  amount: bigint
}

/** `AssetIssueContract.FrozenSupply` — a staked-supply tranche. */
export type AssetIssueFrozenSupply = WithUnknownFields & {
  /** Amount of the token supply frozen (field 1, `int64`). */
  frozenAmount: bigint
  /** Freeze duration, in days (field 2, `int64`). */
  frozenDays: bigint
}

/** `AssetIssueContract` (contract type 6) — create a TRC10 token. */
export type AssetIssueContract = WithUnknownFields & {
  /** Issuer address (field 1). */
  ownerAddress: ContractAddressInput
  /** Token name (field 2, `bytes`, dual string/hex form). */
  name: FlexInput
  /** Token abbreviation (field 3, `bytes`, dual string/hex form). */
  abbr: FlexInput
  /** Total supply (field 4, `int64`). */
  totalSupply: bigint
  /** Staked-supply tranches (field 5, repeated). */
  frozenSupply?: AssetIssueFrozenSupply[] | undefined
  /** TRX numerator of the ICO price ratio `trx_num/num` (field 6, `int32`). */
  trxNum: number
  /** Number of token decimals (field 7, `int32`). */
  precision?: number | undefined
  /** Token numerator of the ICO price ratio `trx_num/num` (field 8, `int32`). */
  num: number
  /** ICO start time, ms (field 9, `int64`). */
  startTime: bigint
  /** ICO end time, ms (field 10, `int64`). */
  endTime: bigint
  /** Vote score (field 16, `int32`). */
  voteScore?: number | undefined
  /** Token description (field 20, `bytes`, dual string/hex form). */
  description: FlexInput
  /** Token website URL (field 21, `bytes`, dual string/hex form). */
  url: FlexInput
  /** Creator-donated bandwidth for holders (field 22, `int64`). */
  freeAssetNetLimit?: bigint | undefined
  /** Per-holder free bandwidth cap (field 23, `int64`). */
  publicFreeAssetNetLimit?: bigint | undefined
}

/** `UpdateAssetContract` (contract type 15) — update a TRC10 token. */
export type UpdateAssetContract = WithUnknownFields & {
  /** Issuer address (field 1). */
  ownerAddress: ContractAddressInput
  /** New token description (field 2, `bytes`, dual string/hex form). */
  description: FlexInput
  /** New token website URL (field 3, `bytes`, dual string/hex form). */
  url: FlexInput
  /** New per-holder free bandwidth (field 4, `int64`). */
  newLimit: bigint
  /** New total free bandwidth (field 5, `int64`). */
  newPublicLimit: bigint
}

/** `FreezeBalanceV2Contract` (contract type 54) — stake 2.0 freeze. */
export type FreezeBalanceV2Contract = WithUnknownFields & {
  /** Account address (field 1). */
  ownerAddress: ContractAddressInput
  /** Amount to freeze, in SUN (field 2, `int64`). */
  frozenBalance: bigint
  /** Resource type (field 3, enum — see `ResourceCode`). */
  resource?: number | undefined
}

/** `UnfreezeBalanceV2Contract` (contract type 55) — stake 2.0 unfreeze. */
export type UnfreezeBalanceV2Contract = WithUnknownFields & {
  /** Account address (field 1). */
  ownerAddress: ContractAddressInput
  /** Amount to unfreeze, in SUN (field 2, `int64`). */
  unfreezeBalance: bigint
  /** Resource type (field 3, enum — see `ResourceCode`). */
  resource?: number | undefined
}

/** `WithdrawExpireUnfreezeContract` (contract type 56). */
export type WithdrawExpireUnfreezeContract = WithUnknownFields & {
  /** Account address (field 1). */
  ownerAddress: ContractAddressInput
}

/** `DelegateResourceContract` (contract type 57). */
export type DelegateResourceContract = WithUnknownFields & {
  /** Delegator address (field 1). */
  ownerAddress: ContractAddressInput
  /** Resource type (field 2, enum — see `ResourceCode`). */
  resource?: number | undefined
  /** Amount to delegate, in SUN (field 3, `int64`). */
  balance: bigint
  /** Recipient address (field 4). */
  receiverAddress: ContractAddressInput
  /** Whether the delegation is locked (field 5, `bool`). */
  lock?: boolean | undefined
  /** Lock period, in blocks (field 6, `int64`). */
  lockPeriod?: bigint | undefined
}

/** `UnDelegateResourceContract` (contract type 58). */
export type UnDelegateResourceContract = WithUnknownFields & {
  /** Delegator address (field 1). */
  ownerAddress: ContractAddressInput
  /** Resource type (field 2, enum — see `ResourceCode`). */
  resource?: number | undefined
  /** Amount to undelegate, in SUN (field 3, `int64`). */
  balance: bigint
  /** Recipient address (field 4). */
  receiverAddress: ContractAddressInput
}

/** `CancelAllUnfreezeV2Contract` (contract type 59). */
export type CancelAllUnfreezeV2Contract = WithUnknownFields & {
  /** Account address (field 1). */
  ownerAddress: ContractAddressInput
}

/** `AccountCreateContract` (contract type 0) — create a new account. */
export type AccountCreateContract = WithUnknownFields & {
  /** Creator (payer) address (field 1). */
  ownerAddress: ContractAddressInput
  /** Address of the account to create (field 2). */
  accountAddress: ContractAddressInput
  /** Account type (field 3, `int32`). */
  type?: number | undefined
}

/** `AccountUpdateContract` (contract type 10) — set an account name. */
export type AccountUpdateContract = WithUnknownFields & {
  /** Account name (field 1, `bytes`, dual string/hex form). */
  accountName: FlexInput
  /** Account address (field 2). */
  ownerAddress: ContractAddressInput
}

/** `SetAccountIdContract` (contract type 19) — set an account id. */
export type SetAccountIdContract = WithUnknownFields & {
  /** Account id (field 1, `bytes`, dual string/hex form). */
  accountId: FlexInput
  /** Account address (field 2). */
  ownerAddress: ContractAddressInput
}

/** `WitnessCreateContract` (contract type 5) — apply to become an SR. */
export type WitnessCreateContract = WithUnknownFields & {
  /** Applicant account address (field 1). */
  ownerAddress: ContractAddressInput
  /** Witness page URL (field 2, `bytes`, dual string/hex form). */
  url: FlexInput
}

/** `WitnessUpdateContract` (contract type 8) — update an SR's URL. */
export type WitnessUpdateContract = WithUnknownFields & {
  /** Witness account address (field 1). */
  ownerAddress: ContractAddressInput
  /** New witness page URL (field 12, `bytes`, dual string/hex form). */
  updateUrl: FlexInput
}

/** `ClearABIContract` (contract type 48) — clear a contract's ABI. */
export type ClearABIContract = WithUnknownFields & {
  /** Owner (deployer) address (field 1). */
  ownerAddress: ContractAddressInput
  /** Contract address (field 2). */
  contractAddress: ContractAddressInput
}

/** `UpdateSettingContract` (contract type 33) — update the user resource share. */
export type UpdateSettingContract = WithUnknownFields & {
  /** Owner (deployer) address (field 1). */
  ownerAddress: ContractAddressInput
  /** Contract address (field 2). */
  contractAddress: ContractAddressInput
  /** Percentage of energy consumed by the caller (field 3, `int64`). */
  consumeUserResourcePercent: bigint
}

/** `UpdateEnergyLimitContract` (contract type 45) — update a contract's energy limit. */
export type UpdateEnergyLimitContract = WithUnknownFields & {
  /** Owner (deployer) address (field 1). */
  ownerAddress: ContractAddressInput
  /** Contract address (field 2). */
  contractAddress: ContractAddressInput
  /** Creator energy limit (field 3, `int64`). */
  originEnergyLimit: bigint
}

/** A single `map<int64,int64>` entry inside `ProposalCreateContract`. */
export type ProposalParameter = WithUnknownFields & {
  /** Chain-parameter id (map key, `int64`). */
  key: bigint
  /** New parameter value (map value, `int64`). */
  value: bigint
}

/** `ProposalCreateContract` (contract type 16) — create a governance proposal. */
export type ProposalCreateContract = WithUnknownFields & {
  /** Proposer address (field 1). */
  ownerAddress: ContractAddressInput
  /** Proposed chain-parameter changes (field 2, `map<int64,int64>`). */
  parameters?: ProposalParameter[] | undefined
}

/** `ProposalApproveContract` (contract type 17) — approve/disapprove a proposal. */
export type ProposalApproveContract = WithUnknownFields & {
  /** Voter address (field 1). */
  ownerAddress: ContractAddressInput
  /** Proposal id (field 2, `int64`). */
  proposalId: bigint
  /** Whether to add (true) or remove (false) approval (field 3, `bool`). */
  isAddApproval?: boolean | undefined
}

/** `ProposalDeleteContract` (contract type 18) — delete a proposal. */
export type ProposalDeleteContract = WithUnknownFields & {
  /** Proposer address (field 1). */
  ownerAddress: ContractAddressInput
  /** Proposal id (field 2, `int64`). */
  proposalId: bigint
}

/** `ExchangeCreateContract` (contract type 41) — create a Bancor exchange pair. */
export type ExchangeCreateContract = WithUnknownFields & {
  /** Creator address (field 1). */
  ownerAddress: ContractAddressInput
  /** First token id (field 2, `bytes`, dual string/hex form). */
  firstTokenId: FlexInput
  /** First token balance seeded into the exchange (field 3, `int64`). */
  firstTokenBalance: bigint
  /** Second token id (field 4, `bytes`, dual string/hex form). */
  secondTokenId: FlexInput
  /** Second token balance seeded into the exchange (field 5, `int64`). */
  secondTokenBalance: bigint
}

/** `ExchangeInjectContract` (contract type 42) — inject liquidity into an exchange. */
export type ExchangeInjectContract = WithUnknownFields & {
  /** Owner address (field 1). */
  ownerAddress: ContractAddressInput
  /** Exchange id (field 2, `int64`). */
  exchangeId: bigint
  /** Token id to inject (field 3, `bytes`, dual string/hex form). */
  tokenId: FlexInput
  /** Amount of the token to inject (field 4, `int64`). */
  quant: bigint
}

/** `ExchangeWithdrawContract` (contract type 43) — withdraw liquidity from an exchange. */
export type ExchangeWithdrawContract = WithUnknownFields & {
  /** Owner address (field 1). */
  ownerAddress: ContractAddressInput
  /** Exchange id (field 2, `int64`). */
  exchangeId: bigint
  /** Token id to withdraw (field 3, `bytes`, dual string/hex form). */
  tokenId: FlexInput
  /** Amount of the token to withdraw (field 4, `int64`). */
  quant: bigint
}

/** `ExchangeTransactionContract` (contract type 44) — trade against an exchange. */
export type ExchangeTransactionContract = WithUnknownFields & {
  /** Trader address (field 1). */
  ownerAddress: ContractAddressInput
  /** Exchange id (field 2, `int64`). */
  exchangeId: bigint
  /** Token id sold into the exchange (field 3, `bytes`, dual string/hex form). */
  tokenId: FlexInput
  /** Amount of the token sold (field 4, `int64`). */
  quant: bigint
  /** Minimum amount of the counter-token expected (field 5, `int64`). */
  expected: bigint
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
