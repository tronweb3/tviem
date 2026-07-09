// TRON-specific, clean-room implementation for @tronweb3/omni (WR-2).
import type { TronAccount } from '../../accounts/types.js'
import type { Client } from '../../clients/createClient.js'
import { AccountNotFoundError } from '../../errors/rpc.js'
import { parseAccount } from '../../types/account.js'
import type { Address } from '../../types/address.js'
import type { ByteArray, Hex } from '../../types/misc.js'
import { toHex } from '../../utils/address/toHex.js'
import { bytesToHex } from '../../utils/encoding/toHex.js'
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
import { getNowBlock } from '../public/getNowBlock.js'
import { broadcastTransaction } from './broadcastTransaction.js'

export type SendTrxParameters = {
  /** The signing account (falls back to `client.account`). */
  account?: TronAccount | Hex | undefined
  /** Recipient Base58Check address. */
  to: Address
  /** Amount to send, in SUN. */
  amount: bigint
  /** Optional memo, written to `raw_data.data` (hex or raw bytes). */
  memo?: Hex | ByteArray | undefined
  /** Injectable clock (ms since epoch) for deterministic tests. */
  now?: bigint | undefined
}
export type SendTrxReturnType = { txID: string }

/**
 * Sends TRX to a recipient by locally building, signing and broadcasting a
 * `TransferContract` transaction (§4.1). The transaction is assembled entirely
 * client-side; the node is used only to fetch the latest block (TaPoS) and to
 * broadcast. `now` is the single point the wall clock is read and is injectable
 * so the built bytes / `txID` are deterministic offline.
 *
 * @param client The Client to use.
 * @param parameters Recipient, amount, optional memo/account/clock.
 * @returns `{ txID }` — the locally computed transaction id.
 */
export async function sendTrx(
  client: Client,
  parameters: SendTrxParameters,
): Promise<SendTrxReturnType> {
  const { to, amount, memo } = parameters

  // Resolve the signing account (per-call, else hoisted on the Client).
  const source = parameters.account ?? client.account
  if (!source) throw new AccountNotFoundError()
  const account = parseAccount(source)

  // The only wall-clock read in the write pipeline — injectable for tests.
  const now = parameters.now ?? BigInt(Date.now())

  // ① / ② build the TransferContract (addresses enter the body as 41-hex).
  const contract: RawContract = {
    type: ContractType.TransferContract,
    parameter: {
      typeUrl: `${contractTypeUrlPrefix}TransferContract`,
      value: {
        ownerAddress: toHex(account.address),
        toAddress: toHex(to),
        amount,
      },
    },
  }

  // ③ assemble raw_data (memo → bare-hex `data`).
  let rawData: RawData = { contract: [contract], timestamp: now }
  if (memo !== undefined) rawData = { ...rawData, data: memoToHex(memo) }

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

/** Normalizes a memo to bare (no `0x`), lowercase hex. */
function memoToHex(memo: Hex | ByteArray): string {
  if (typeof memo === 'string')
    return (memo.startsWith('0x') ? memo.slice(2) : memo).toLowerCase()
  return bytesToHex(memo).slice(2)
}
