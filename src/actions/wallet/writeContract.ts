import type { Abi } from 'abitype'
import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import { defaultFeeLimit } from '../../constants/address.js'
import { AccountNotFoundError } from '../../errors/rpc.js'
import { parseAccount } from '../../types/account.js'
import type { Address } from '../../types/address.js'
import type { Hex } from '../../types/misc.js'
import { encodeFunctionData } from '../../utils/abi/encodeFunctionData.js'
import { toHex } from '../../utils/address/toHex.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../utils/transaction/registry.js'
import type { RawContract } from '../../utils/transaction/serializeRawData.js'
import type { TriggerSmartContract } from '../../utils/transaction/types.js'
import { buildAndBroadcast } from './utils/buildAndBroadcast.js'
import {
  type BuildTransactionReturnType,
  buildTransaction,
  type TransactionHeader,
} from './utils/buildTransaction.js'

export type WriteContractParameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** The contract's Base58Check address. */
  address: Address
  /** The contract ABI. */
  abi: Abi
  /** The function to call. */
  functionName: string
  /** The function arguments. */
  args?: readonly unknown[] | undefined
  /** Fee limit (in SUN) written into `raw_data` (defaults to `defaultFeeLimit`). */
  feeLimit?: bigint | undefined
  /** TRX value (in SUN) to attach to the call. */
  callValue?: bigint | undefined
  /**
   * A pre-derived TaPoS + timing header. When supplied the transaction is built
   * fully offline against it; otherwise it is derived from the latest block.
   */
  blockHeader?: TransactionHeader | undefined
}
export type WriteContractReturnType = { txID: string }

export type BuildWriteContractParameters = WriteContractParameters & {
  /** Multi-sig permission id (`Contract.Permission_id`). */
  permissionId?: number | undefined
}
export type BuildWriteContractReturnType = BuildTransactionReturnType

/** The signing account plus the assembled `TriggerSmartContract` and fee limit. */
function assemble(
  client: Client,
  parameters: WriteContractParameters,
): { account: TronAccount; contract: RawContract; feeLimit: bigint } {
  const { abi, address, args, callValue, functionName } = parameters

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
    owner_address: toHex(account.address),
    contract_address: toHex(address),
    data,
  }
  if (callValue !== undefined) value.call_value = callValue

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
 * callValue/account/permissionId/blockHeader.
 * @returns A TronWeb-shaped unsigned transaction ({@link BuildTransactionReturnType}).
 */
export async function buildWriteContract(
  client: Client,
  parameters: BuildWriteContractParameters,
): Promise<BuildWriteContractReturnType> {
  const { contract, feeLimit } = assemble(client, parameters)
  return buildTransaction(client, {
    contract,
    feeLimit,
    permissionId: parameters.permissionId,
    blockHeader: parameters.blockHeader,
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
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function writeContract(
  client: Client,
  parameters: WriteContractParameters,
): Promise<WriteContractReturnType> {
  const { account, contract, feeLimit } = assemble(client, parameters)
  return buildAndBroadcast(client, {
    contract,
    account,
    feeLimit,
    blockHeader: parameters.blockHeader,
  })
}
