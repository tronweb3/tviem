/**
 * Test helper: reads a `broadcasttransaction` request body (`{ txID, raw_data,
 * raw_data_hex, signature }`, the signed transaction in node JSON) back into
 * the signed-tx shape. `raw_data` and `txID` are re-derived from the
 * `raw_data_hex` bytes so write-action tests keep asserting on the locally
 * built transaction byte-for-byte.
 */

import { decodeRawData } from '../../src/utils/transaction/decodeRawData.js'
import { getTransactionId } from '../../src/utils/transaction/getTransactionId.js'
import type { RawData } from '../../src/utils/transaction/serializeRawData.js'

export type ParsedBroadcast = {
  txID: string
  raw_data_hex: string
  raw_data: RawData
  signature: string[]
}

/** Parses `{ txID, raw_data, raw_data_hex, signature }` into the signed-tx shape. */
export function parseBroadcast(body: unknown): ParsedBroadcast {
  const { raw_data_hex, signature } = body as {
    raw_data_hex?: unknown
    signature?: unknown
  }
  if (typeof raw_data_hex !== 'string')
    throw new Error('parseBroadcast: body has no `raw_data_hex` string.')
  if (
    !Array.isArray(signature) ||
    signature.some((sig) => typeof sig !== 'string')
  )
    throw new Error('parseBroadcast: body has no `signature` string array.')

  const raw_data = decodeRawData(raw_data_hex)
  return {
    txID: getTransactionId(raw_data),
    raw_data_hex,
    raw_data,
    signature: signature as string[],
  }
}
