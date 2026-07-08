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

/** Union of all registered (known) contract message models. */
export type ContractMessage =
  | TransferContract
  | TransferAssetContract
  | VoteWitnessContract
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
