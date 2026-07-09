export type {
  Abi,
  AbiEvent,
  AbiFunction,
  AbiParameter,
  AbiParameterKind,
  AbiParameterToPrimitiveType,
  AbiStateMutability,
} from 'abitype'
// biome-ignore lint/performance/noBarrelFile: entrypoint module
export {
  type GeneratePrivateKeyErrorType,
  generatePrivateKey,
} from './accounts/generatePrivateKey.js'
export {
  type PrivateKeyToAccountErrorType,
  privateKeyToAccount,
} from './accounts/privateKeyToAccount.js'
export { type ToAccountErrorType, toAccount } from './accounts/toAccount.js'
export type {
  AccountSignMessageParameters,
  AccountSignParameters,
  AccountSource,
  SignableTransaction,
  TronAccount,
  TronCustomAccount,
  TronCustomSource,
  TronLocalAccount,
} from './accounts/types.js'
export {
  type PrivateKeyToAddressErrorType,
  privateKeyToAddress,
} from './accounts/utils/privateKeyToAddress.js'
export {
  type SignTransactionErrorType,
  signTransaction,
} from './accounts/utils/signTransaction.js'
// Read (public) actions — also available via the `@tronweb3/omni/actions` subpath.
export {
  type GetBalanceParameters,
  type GetBalanceReturnType,
  getBalance,
} from './actions/public/getBalance.js'
export {
  type GetBlockParameters,
  type GetBlockReturnType,
  getBlock,
} from './actions/public/getBlock.js'
export {
  type GetChainParametersReturnType,
  getChainParameters,
  getEnergyFee,
  getTransactionFee,
} from './actions/public/getChainParameters.js'
export {
  type GetNowBlockReturnType,
  getNowBlock,
} from './actions/public/getNowBlock.js'
export {
  type GetTransactionInfoParameters,
  type GetTransactionInfoReturnType,
  getTransactionInfo,
} from './actions/public/getTransactionInfo.js'
export {
  type ReadContractParameters,
  type ReadContractReturnType,
  readContract,
} from './actions/public/readContract.js'
export {
  type TransactionReceipt,
  type WaitForTransactionReceiptParameters,
  type WaitForTransactionReceiptReturnType,
  waitForTransactionReceipt,
} from './actions/public/waitForTransactionReceipt.js'
export {
  type DefineChainReturnType,
  defineChain,
} from './chains/defineChain.js'
export { mainnet } from './chains/definitions/mainnet.js'
export { nile } from './chains/definitions/nile.js'
export { shasta } from './chains/definitions/shasta.js'
// ---------------------------------------------------------------------------
// v0.1b — clients / transports / chains / read actions (read-path slice)
// Write (wallet) actions — sendTrx / writeContract / broadcastTransaction —
// are T5 stubs and intentionally NOT re-exported here yet.
// ---------------------------------------------------------------------------
export {
  type Client,
  type ClientConfig,
  type CreateClientErrorType,
  createClient,
} from './clients/createClient.js'
export {
  type CreatePublicClientErrorType,
  createPublicClient,
  type PublicClient,
  type PublicClientConfig,
} from './clients/createPublicClient.js'
export {
  type CreateWalletClientErrorType,
  createWalletClient,
  type WalletClient,
  type WalletClientConfig,
} from './clients/createWalletClient.js'
export {
  type PublicActions,
  publicActions,
} from './clients/decorators/public.js'
export {
  type WalletActions,
  walletActions,
} from './clients/decorators/wallet.js'
export {
  type CreateTransportErrorType,
  createTransport,
  type Transport,
  type TransportConfig,
} from './clients/transports/createTransport.js'
export {
  type HttpTransport,
  type HttpTransportConfig,
  http,
  normalizeTronError,
} from './clients/transports/http.js'
export { trxUnits } from './constants/unit.js'
export {
  AbiConstructorNotFoundError,
  type AbiConstructorNotFoundErrorType,
  AbiConstructorParamsNotFoundError,
  type AbiConstructorParamsNotFoundErrorType,
  AbiDecodingDataSizeInvalidError,
  type AbiDecodingDataSizeInvalidErrorType,
  AbiDecodingDataSizeTooSmallError,
  type AbiDecodingDataSizeTooSmallErrorType,
  AbiDecodingZeroDataError,
  type AbiDecodingZeroDataErrorType,
  AbiEncodingArrayLengthMismatchError,
  type AbiEncodingArrayLengthMismatchErrorType,
  AbiEncodingBytesSizeMismatchError,
  type AbiEncodingBytesSizeMismatchErrorType,
  AbiEncodingLengthMismatchError,
  type AbiEncodingLengthMismatchErrorType,
  AbiErrorInputsNotFoundError,
  type AbiErrorInputsNotFoundErrorType,
  AbiErrorNotFoundError,
  type AbiErrorNotFoundErrorType,
  AbiErrorSignatureNotFoundError,
  type AbiErrorSignatureNotFoundErrorType,
  AbiEventNotFoundError,
  type AbiEventNotFoundErrorType,
  AbiEventSignatureEmptyTopicsError,
  type AbiEventSignatureEmptyTopicsErrorType,
  AbiEventSignatureNotFoundError,
  type AbiEventSignatureNotFoundErrorType,
  AbiFunctionNotFoundError,
  type AbiFunctionNotFoundErrorType,
  AbiFunctionOutputsNotFoundError,
  type AbiFunctionOutputsNotFoundErrorType,
  AbiFunctionSignatureNotFoundError,
  type AbiFunctionSignatureNotFoundErrorType,
  AbiItemAmbiguityError,
  type AbiItemAmbiguityErrorType,
  BytesSizeMismatchError,
  type BytesSizeMismatchErrorType,
  DecodeLogDataMismatch,
  type DecodeLogDataMismatchErrorType,
  DecodeLogTopicsMismatch,
  type DecodeLogTopicsMismatchErrorType,
  InvalidAbiDecodingTypeError,
  type InvalidAbiDecodingTypeErrorType,
  InvalidAbiEncodingTypeError,
  type InvalidAbiEncodingTypeErrorType,
  InvalidArrayError,
  type InvalidArrayErrorType,
  InvalidDefinitionTypeError,
  type InvalidDefinitionTypeErrorType,
  UnsupportedPackedAbiType,
  type UnsupportedPackedAbiTypeErrorType,
} from './errors/abi.js'
export {
  InvalidAddressError,
  type InvalidAddressErrorType,
} from './errors/address.js'
export { BaseError, type BaseErrorType, setErrorConfig } from './errors/base.js'
export {
  NegativeOffsetError,
  type NegativeOffsetErrorType,
  PositionOutOfBoundsError,
  type PositionOutOfBoundsErrorType,
  RecursiveReadLimitExceededError,
  type RecursiveReadLimitExceededErrorType,
} from './errors/cursor.js'
export {
  InvalidBytesLengthError,
  type InvalidBytesLengthErrorType,
  SizeExceedsPaddingSizeError,
  type SizeExceedsPaddingSizeErrorType,
  SliceOffsetOutOfBoundsError,
  type SliceOffsetOutOfBoundsErrorType,
} from './errors/data.js'
export {
  IntegerOutOfRangeError,
  type IntegerOutOfRangeErrorType,
  InvalidBytesBooleanError,
  type InvalidBytesBooleanErrorType,
  InvalidHexBooleanError,
  type InvalidHexBooleanErrorType,
  InvalidHexValueError,
  type InvalidHexValueErrorType,
  RlpDepthLimitExceededError,
  type RlpDepthLimitExceededErrorType,
  SizeOverflowError,
  type SizeOverflowErrorType,
} from './errors/encoding.js'
export {
  FilterTypeNotSupportedError,
  type FilterTypeNotSupportedErrorType,
} from './errors/log.js'
// TRON node error family (transport-level, error normalization).
export {
  TronBroadcastError,
  type TronBroadcastErrorType,
  TronContractValidateError,
  type TronContractValidateErrorType,
  TronNodeError,
  type TronNodeErrorParameters,
  type TronNodeErrorType,
  TronValidationError,
  type TronValidationErrorType,
  UnknownNodeError,
  type UnknownNodeErrorType,
} from './errors/node.js'
export {
  HttpRequestError,
  type HttpRequestErrorType,
  TimeoutError,
  type TimeoutErrorType,
} from './errors/request.js'
// Action-level (RPC) error family.
export {
  AccountNotFoundError,
  type AccountNotFoundErrorType,
  BlockNotFoundError,
  type BlockNotFoundErrorType,
  CallExecutionError,
  type CallExecutionErrorType,
  ContractFunctionRevertedError,
  type ContractFunctionRevertedErrorType,
  TransactionExpiredError,
  type TransactionExpiredErrorType,
  TronRpcError,
  type TronRpcErrorType,
  WaitForTransactionReceiptTimeoutError,
  type WaitForTransactionReceiptTimeoutErrorType,
} from './errors/rpc.js'
export {
  UrlRequiredError,
  type UrlRequiredErrorType,
} from './errors/transport.js'
export {
  InvalidDecimalNumberError,
  type InvalidDecimalNumberErrorType,
} from './errors/unit.js'
export {
  type ParseAccount,
  type ParseAccountErrorType,
  parseAccount,
} from './types/account.js'
export type {
  Address,
  AddressInput,
  EvmAddress,
  TronHexAddress,
} from './types/address.js'
export type { Block } from './types/block.js'
export type {
  Chain,
  ChainConfig,
  ExtendChain,
  TronContract,
  TronNativeCurrency,
  TronRpcEndpoint,
  TronRpcUrls,
} from './types/chain.js'
export type {
  AbiEventParametersToPrimitiveTypes,
  AbiEventParameterToPrimitiveType,
  AbiEventTopicToPrimitiveType,
  AbiItem,
  AbiItemArgs,
  AbiItemName,
  ContractConstructorArgs,
  ContractErrorArgs,
  ContractErrorName,
  ContractEventArgs,
  ContractEventArgsFromTopics,
  ContractEventName,
  ContractFunctionArgs,
  ContractFunctionName,
  ContractFunctionParameters,
  ContractFunctionReturnType,
  EventDefinition,
  ExtractAbiFunctionForArgs,
  ExtractAbiItem,
  ExtractAbiItemForArgs,
  ExtractAbiItemNames,
  GetEventArgs,
  LogTopicType,
  MaybeAbiEventName,
  MaybeExtractEventArgsFromAbi,
  UnionWiden,
  Widen,
} from './types/contract.js'
export type {
  ByteArray,
  CompactSignature,
  Hash,
  Hex,
  LogTopic,
  SignableMessage,
} from './types/misc.js'
export type {
  TransactionInfo,
  TransactionLog,
  TransactionStatus,
} from './types/transaction.js'
export type {
  TronNode,
  TronRequestArgs,
  TronRequestFn,
  TronRequestOptions,
} from './types/transport.js'
export type {
  Assign,
  Branded,
  Compute,
  Evaluate,
  ExactPartial,
  ExactRequired,
  IsNarrowable,
  IsNever,
  IsUndefined,
  IsUnion,
  LooseOmit,
  MaybePartial,
  MaybePromise,
  MaybeRequired,
  Mutable,
  NoInfer,
  NoUndefined,
  Omit,
  OneOf,
  Or,
  PartialBy,
  Prettify,
  RequiredBy,
  Some,
  UnionEvaluate,
  UnionLooseOmit,
  UnionOmit,
  UnionPartialBy,
  UnionPick,
  UnionRequiredBy,
  UnionToTuple,
  ValueOf,
} from './types/utils.js'
export {
  type DecodeAbiParametersErrorType,
  type DecodeAbiParametersReturnType,
  decodeAbiParameters,
} from './utils/abi/decodeAbiParameters.js'
export {
  type DecodeEventLogErrorType,
  type DecodeEventLogParameters,
  type DecodeEventLogReturnType,
  decodeEventLog,
} from './utils/abi/decodeEventLog.js'
export {
  type DecodeFunctionResultErrorType,
  type DecodeFunctionResultParameters,
  type DecodeFunctionResultReturnType,
  decodeFunctionResult,
} from './utils/abi/decodeFunctionResult.js'
export {
  type EncodeAbiParametersErrorType,
  type EncodeAbiParametersReturnType,
  encodeAbiParameters,
  getArrayComponents,
} from './utils/abi/encodeAbiParameters.js'
export {
  type EncodeEventTopicsErrorType,
  type EncodeEventTopicsParameters,
  type EncodeEventTopicsReturnType,
  encodeEventTopics,
} from './utils/abi/encodeEventTopics.js'
export {
  type EncodeFunctionDataErrorType,
  type EncodeFunctionDataParameters,
  type EncodeFunctionDataReturnType,
  encodeFunctionData,
} from './utils/abi/encodeFunctionData.js'
export {
  type EncodePackedErrorType,
  encodePacked,
  type PackedAbiType,
} from './utils/abi/encodePacked.js'
export {
  type FormatAbiItemErrorType,
  type FormatAbiParamErrorType,
  type FormatAbiParamsErrorType,
  formatAbiItem,
  formatAbiParams,
} from './utils/abi/formatAbiItem.js'
export {
  type GetAbiItemErrorType,
  type GetAbiItemParameters,
  type GetAbiItemReturnType,
  getAbiItem,
} from './utils/abi/getAbiItem.js'
export {
  type PrepareEncodeFunctionDataErrorType,
  type PrepareEncodeFunctionDataParameters,
  type PrepareEncodeFunctionDataReturnType,
  prepareEncodeFunctionData,
} from './utils/abi/prepareEncodeFunctionData.js'
export {
  type DecodeBase58CheckErrorType,
  decodeBase58Check,
  type EncodeBase58CheckErrorType,
  encodeBase58Check,
  type TryDecodeBase58CheckErrorType,
  tryDecodeBase58Check,
} from './utils/address/base58check.js'
export {
  type IsAddressErrorType,
  type IsAddressOptions,
  isAddress,
} from './utils/address/isAddress.js'
export {
  type IsAddressEqualErrorType,
  isAddressEqual,
} from './utils/address/isAddressEqual.js'
export {
  type NormalizeAddressErrorType,
  normalizeAddress,
} from './utils/address/normalize.js'
export {
  type PublicKeyToAddressErrorType,
  publicKeyToAddress,
} from './utils/address/publicKeyToAddress.js'
export {
  type HexToBase58ErrorType,
  hexToBase58,
  type ToBase58ErrorType,
  toBase58,
} from './utils/address/toBase58.js'
export {
  type AddressToHexErrorType,
  addressToHex,
  type ToEvmErrorType,
  toEvm,
} from './utils/address/toEvm.js'
export {
  type ToHexErrorType as ToTronHexErrorType,
  toHex as toTronHex,
} from './utils/address/toHex.js'
export {
  type ConcatBytesErrorType,
  type ConcatErrorType,
  type ConcatHexErrorType,
  concat,
  concatBytes,
  concatHex,
} from './utils/data/concat.js'
export { type IsHexErrorType, isHex } from './utils/data/isHex.js'
export {
  type PadBytesErrorType,
  type PadErrorType,
  type PadHexErrorType,
  pad,
  padBytes,
  padHex,
} from './utils/data/pad.js'
export { type SizeErrorType, size } from './utils/data/size.js'
export {
  type AssertEndOffsetErrorType,
  type AssertStartOffsetErrorType,
  type SliceBytesErrorType,
  type SliceErrorType,
  type SliceHexErrorType,
  type SliceReturnType,
  slice,
  sliceBytes,
  sliceHex,
} from './utils/data/slice.js'
export {
  type TrimErrorType,
  type TrimReturnType,
  trim,
} from './utils/data/trim.js'
export {
  type BytesToBigIntErrorType,
  type BytesToBigIntOpts,
  type BytesToBoolErrorType,
  type BytesToBoolOpts,
  type BytesToNumberErrorType,
  type BytesToNumberOpts,
  type BytesToStringErrorType,
  type BytesToStringOpts,
  bytesToBigInt,
  bytesToBigInt as bytesToBigint,
  bytesToBool,
  bytesToNumber,
  bytesToString,
  type FromBytesErrorType,
  type FromBytesParameters,
  type FromBytesReturnType,
  fromBytes,
} from './utils/encoding/fromBytes.js'
export {
  type AssertSizeErrorType,
  type FromHexErrorType,
  type FromHexParameters,
  type FromHexReturnType,
  fromHex,
  type HexToBigIntErrorType,
  type HexToBigIntOpts,
  type HexToBoolErrorType,
  type HexToBoolOpts,
  type HexToNumberErrorType,
  type HexToNumberOpts,
  type HexToStringErrorType,
  type HexToStringOpts,
  hexToBigInt,
  hexToBool,
  hexToNumber,
  hexToString,
} from './utils/encoding/fromHex.js'
export {
  type BoolToBytesErrorType,
  type BoolToBytesOpts,
  boolToBytes,
  type HexToBytesErrorType,
  type HexToBytesOpts,
  hexToBytes,
  type NumberToBytesErrorType,
  numberToBytes,
  type StringToBytesErrorType,
  type StringToBytesOpts,
  stringToBytes,
  type ToBytesErrorType,
  type ToBytesParameters,
  toBytes,
} from './utils/encoding/toBytes.js'
export {
  type BoolToHexErrorType,
  type BoolToHexOpts,
  type BytesToHexErrorType,
  type BytesToHexOpts,
  boolToHex,
  bytesToHex,
  type NumberToHexErrorType,
  type NumberToHexOpts,
  numberToHex,
  type StringToHexErrorType,
  type StringToHexOpts,
  stringToHex,
  type ToHexErrorType,
  type ToHexParameters,
  toHex,
} from './utils/encoding/toHex.js'
export {
  type Keccak256ErrorType,
  keccak256,
} from './utils/hash/keccak256.js'
export { type Sha256ErrorType, sha256 } from './utils/hash/sha256.js'
export {
  type ToEventSelectorErrorType,
  toEventSelector,
} from './utils/hash/toEventSelector.js'
export {
  type ToFunctionSelectorErrorType,
  toFunctionSelector,
} from './utils/hash/toFunctionSelector.js'
export {
  type HashMessageErrorType,
  hashMessage,
  presignMessagePrefix,
} from './utils/signature/hashMessage.js'
export {
  type SerializeSignatureErrorType,
  type Signature,
  type SignErrorType,
  type SignParameters,
  serializeSignature,
  sign,
} from './utils/signature/sign.js'
export {
  type SignMessageErrorType,
  type SignMessageParameters,
  signMessage,
} from './utils/signature/signMessage.js'
export {
  type RecoverMessageAddressErrorType,
  type RecoverMessageAddressParameters,
  type RecoverPublicKeyErrorType,
  recoverMessageAddress,
  recoverPublicKey,
  type SignatureInput,
  type VerifyMessageErrorType,
  type VerifyMessageParameters,
  verifyMessage,
} from './utils/signature/verifyMessage.js'
export {
  type DecodeRawDataErrorType,
  decodeRawData,
} from './utils/transaction/decodeRawData.js'
export {
  type GenContractAddressErrorType,
  genContractAddress,
} from './utils/transaction/genContractAddress.js'
export {
  type GetTransactionIdErrorType,
  getTransactionId,
} from './utils/transaction/getTransactionId.js'
export {
  type BlockRef,
  type DeriveRefBlockParamsErrorType,
  defaultExpirationMs,
  deriveRefBlockParams,
  type FillBlockHeaderErrorType,
  fillBlockHeader,
  type RefBlockParams,
} from './utils/transaction/prepareTransaction.js'
export {
  type ContractCodec,
  ContractType,
  contractCodecs,
  contractTypeUrlPrefix,
  decodeContractParameter,
  getContractCodecByType,
  getContractCodecByTypeUrl,
} from './utils/transaction/registry.js'
export {
  type RawContract,
  type RawData,
  type SerializeRawDataErrorType,
  serializeRawData,
  type ToRawDataHexErrorType,
  toRawDataHex,
} from './utils/transaction/serializeRawData.js'
export {
  type TxCheckErrorType,
  txCheck,
} from './utils/transaction/txCheck.js'
export type {
  AccountPermissionUpdateContract,
  BytesInput,
  CancelAllUnfreezeV2Contract,
  ContractAddressInput,
  ContractMessage,
  CreateSmartContract,
  DelegateResourceContract,
  FlexInput,
  FreezeBalanceV2Contract,
  Permission,
  PermissionKey,
  SmartContract,
  SmartContractAbi,
  SmartContractAbiEntry,
  SmartContractAbiParam,
  TransferAssetContract,
  TransferContract,
  TriggerSmartContract,
  UnDelegateResourceContract,
  UnfreezeBalanceV2Contract,
  UnknownContractParameter,
  UnknownField,
  Vote,
  VoteWitnessContract,
  WithdrawBalanceContract,
  WithdrawExpireUnfreezeContract,
  WithUnknownFields,
} from './utils/transaction/types.js'
export {
  EntryType,
  PermissionType,
  ResourceCode,
  StateMutabilityType,
} from './utils/transaction/types.js'
export {
  type FormatTrxErrorType,
  formatTrx,
} from './utils/units/formatTrx.js'
export {
  type FormatUnitsErrorType,
  formatUnits,
} from './utils/units/formatUnits.js'
export { type ParseTrxErrorType, parseTrx } from './utils/units/parseTrx.js'
export {
  type ParseUnitsErrorType,
  parseUnits,
} from './utils/units/parseUnits.js'
