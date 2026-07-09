// TRON-specific, clean-room implementation for @tronweb3/omni (WR-3).
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
import { getAction } from '../../utils/getAction.js'
import { fillBlockHeader } from '../../utils/transaction/prepareTransaction.js'
import {
  ContractType,
  contractTypeUrlPrefix,
} from '../../utils/transaction/registry.js'
import type {
  RawContract,
  RawData,
} from '../../utils/transaction/serializeRawData.js'
import type { TriggerSmartContract } from '../../utils/transaction/types.js'
import { getNowBlock } from '../public/getNowBlock.js'
import { broadcastTransaction } from './broadcastTransaction.js'

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
  /** Injectable clock (ms since epoch) for deterministic tests. */
  now?: bigint | undefined
}
export type WriteContractReturnType = { txID: string }

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
 * @param parameters Contract address / ABI / function / args / fee / clock.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function writeContract(
  client: Client,
  parameters: WriteContractParameters,
): Promise<WriteContractReturnType> {
  const { abi, address, args, callValue, functionName } = parameters

  // Resolve the signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  // The only wall-clock read in the write pipeline — injectable for tests.
  const now = parameters.now ?? BigInt(Date.now())
  const feeLimit = parameters.feeLimit ?? defaultFeeLimit

  // ① build the calldata (full selector + params).
  const data = encodeFunctionData({ abi, functionName, args })

  // ② build the TriggerSmartContract (addresses enter the body as 41-hex).
  const value: TriggerSmartContract = {
    ownerAddress: toHex(account.address),
    contractAddress: toHex(address),
    data,
  }
  if (callValue !== undefined) value.callValue = callValue

  const contract: RawContract = {
    type: ContractType.TriggerSmartContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}TriggerSmartContract`,
      value,
    },
  }

  // ③ raw_data carrying feeLimit (field 18, part of the signed hash).
  let rawData: RawData = { contract: [contract], timestamp: now, feeLimit }

  // ④ fill TaPoS reference fields + expiration from the latest block.
  const block = await getAction(
    client,
    getNowBlock,
    'getNowBlock',
  )(undefined as never)
  rawData = fillBlockHeader(rawData, block, now)

  // ⑤ / ⑥ sign locally (recomputes txID, owner guard, txCheck, appends sig).
  const signed = account.signTransaction({ raw_data: rawData })

  // ⑦ broadcast; the local txID is authoritative.
  await getAction(
    client,
    broadcastTransaction,
    'broadcastTransaction',
  )({ signedTransaction: signed })

  return { txID: signed.txID ?? '' }
}
