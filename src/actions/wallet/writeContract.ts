import type { Abi, AbiFunction, ExtractAbiFunction } from 'abitype'
import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import { defaultFeeLimit } from '../../constants/transaction.js'
import {
  AccountNotFoundError,
  type AccountNotFoundErrorType,
} from '../../errors/rpc.js'
import type { ErrorType } from '../../errors/utils.js'
import {
  type ParseAccountErrorType,
  parseAccount,
} from '../../types/account.js'
import type { Address } from '../../types/address.js'
import type { ContractFunctionName } from '../../types/contract.js'
import type { Hex } from '../../types/misc.js'
import type { TronAbiParametersToPrimitiveTypes } from '../../utils/abi/encodeAbiParameters.js'
import {
  type EncodeFunctionDataErrorType,
  encodeFunctionData,
} from '../../utils/abi/encodeFunctionData.js'
import {
  type AddressToHexErrorType,
  addressToHex,
} from '../../utils/address/addressToHex.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../utils/transaction/registry.js'
import type { RawContract } from '../../utils/transaction/serializeRawData.js'
import type { TriggerSmartContract } from '../../utils/transaction/types.js'
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

export type WriteContractParameters<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends ContractFunctionName<
    abi,
    'nonpayable' | 'payable'
  > = ContractFunctionName<abi, 'nonpayable' | 'payable'>,
  ///
  allFunctionNames = ContractFunctionName<abi, 'nonpayable' | 'payable'>,
  abiFunction extends AbiFunction = abi extends Abi
    ? ExtractAbiFunction<abi, functionName, 'nonpayable' | 'payable'>
    : AbiFunction,
  // Falls back to `readonly unknown[]` when the function cannot be extracted
  // (wide abi, empty abi, unknown name) so the wide call shape keeps working.
  allArgs = [abiFunction] extends [never]
    ? readonly unknown[]
    : TronAbiParametersToPrimitiveTypes<abiFunction['inputs'], 'inputs'>,
> = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** The contract's Base58Check address. */
  address: Address
  /** The contract ABI. */
  abi: abi
  /** The function to call. */
  functionName:
    | allFunctionNames // show all options
    | (functionName extends allFunctionNames ? functionName : never) // infer value
  /** Fee limit (in SUN) written into `raw_data` (defaults to `defaultFeeLimit`). */
  feeLimit?: bigint | undefined
  /** TRX value (in SUN) to attach to the call. */
  callValue?: bigint | undefined
  /** TRC10 amount sent with the call (`call_token_value`). */
  callTokenValue?: bigint | undefined
  /** TRC10 token id (`TriggerSmartContract.token_id`). */
  tokenId?: bigint | undefined
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
} & (readonly [] extends allArgs
  ? {
      /** The function arguments. */
      args?: allArgs | undefined
    }
  : {
      /** The function arguments. */
      args: allArgs
    })
export type WriteContractReturnType = BuildAndBroadcastReturnType

export type WriteContractErrorType =
  | AccountNotFoundErrorType
  | BuildAndBroadcastErrorType
  | EncodeFunctionDataErrorType
  | ParseAccountErrorType
  | AddressToHexErrorType
  | ErrorType

export type BuildWriteContractParameters<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends ContractFunctionName<
    abi,
    'nonpayable' | 'payable'
  > = ContractFunctionName<abi, 'nonpayable' | 'payable'>,
> = WriteContractParameters<abi, functionName> & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildWriteContractReturnType = BuildTransactionReturnType

export type BuildWriteContractErrorType =
  | AccountNotFoundErrorType
  | BuildTransactionErrorType
  | EncodeFunctionDataErrorType
  | ParseAccountErrorType
  | AddressToHexErrorType
  | ErrorType

/** The signing account plus the assembled `TriggerSmartContract` and fee limit. */
function assemble(
  client: Client,
  parameters: WriteContractParameters,
): { account: TronAccount; contract: RawContract; feeLimit: bigint } {
  const {
    abi,
    address,
    args,
    callTokenValue,
    callValue,
    functionName,
    tokenId,
  } = parameters

  // Resolve the signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  // feeLimit enters raw_data (field 18) and therefore the signed hash.
  const feeLimit = parameters.feeLimit ?? defaultFeeLimit

  // ① build the calldata (full selector + params).
  const data = encodeFunctionData({ abi, functionName, args })

  // ② build the TriggerSmartContract (addresses enter the body as 41-hex).
  const value: TriggerSmartContract = {
    owner_address: addressToHex(account.address),
    contract_address: addressToHex(address),
    data,
  }
  if (callValue !== undefined) value.call_value = callValue
  if (callTokenValue !== undefined) value.call_token_value = callTokenValue
  if (tokenId !== undefined) value.token_id = tokenId

  const contract: RawContract = {
    type: ContractType.TriggerSmartContract,
    parameter: {
      type_url: `${contractTypeUrlPrefix}TriggerSmartContract`,
      value,
    },
  }

  return { account, contract, feeLimit }
}

/**
 * Builds an **unsigned** `TriggerSmartContract` transaction (§4.2) and returns
 * it in java-tron's HTTP JSON shape (TronWeb-compatible `{ visible, txID,
 * raw_data, raw_data_hex }`) — the build half of {@link writeContract}, without
 * signing or broadcasting. `feeLimit` still enters the signed hash (field 18)
 * and defaults to {@link defaultFeeLimit}. Pass `permissionId` to bind it to an
 * active/owner permission. The node is used only to fetch the latest block
 * (TaPoS).
 *
 * @param client The Client to use.
 * @param parameters Contract address / ABI / function / args / fee, optional
 * callValue/callTokenValue/tokenId/account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildWriteContract<
  const abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'>,
>(
  client: Client,
  parameters: BuildWriteContractParameters<abi, functionName>,
): Promise<BuildWriteContractReturnType> {
  const parameters_ = parameters as BuildWriteContractParameters
  const { contract, feeLimit } = assemble(client, parameters_)
  return buildTransaction(client, {
    contract,
    feeLimit,
    permissionId: parameters_.permissionId,
    blockHeader: parameters_.blockHeader,
    expirationMs: parameters_.expirationMs,
    memo: parameters_.memo,
  })
}

/**
 * Writes to (state-changing calls) a contract function by locally building,
 * signing and broadcasting a `TriggerSmartContract` transaction (§4.2). The
 * calldata is produced by {@link encodeFunctionData}; the whole transaction is
 * assembled client-side, with the node used only to fetch the latest block and
 * to broadcast.
 *
 * `feeLimit` is written into `raw_data` (field 18) and therefore enters the
 * signed hash — it cannot be added after broadcast. It defaults to
 * {@link defaultFeeLimit}; callers who want a tighter bound can pre-compute it
 * with `estimateEnergy` and pass it explicitly (kept opt-in so the built bytes
 * stay deterministic and no extra node round-trip is forced).
 *
 * @param client The Client to use.
 * @param parameters Contract address / ABI / function / args / fee / blockHeader.
 * @returns `{ txID, result, code, message }` — the locally computed
 * transaction id plus the node's acknowledgement fields, when echoed.
 */
export async function writeContract<
  const abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'>,
>(
  client: Client,
  parameters: WriteContractParameters<abi, functionName>,
): Promise<WriteContractReturnType> {
  const parameters_ = parameters as WriteContractParameters
  const { account, contract, feeLimit } = assemble(client, parameters_)
  return buildAndBroadcast(client, {
    contract,
    account,
    feeLimit,
    blockHeader: parameters_.blockHeader,
    expirationMs: parameters_.expirationMs,
    memo: parameters_.memo,
  })
}
